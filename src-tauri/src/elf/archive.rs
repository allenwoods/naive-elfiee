use crate::engine::{EventPoolWithPath, EventStore};
use std::fs::File;
use std::path::{Path, PathBuf};
use tempfile::TempDir;
use walkdir::WalkDir;
use zip::{ZipArchive, ZipWriter};

pub struct ElfArchive {
    temp_dir: TempDir,
    db_path: PathBuf,
}

impl ElfArchive {
    /// Create a new empty .elf archive
    pub async fn new() -> std::io::Result<Self> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("events.db");

        // Initialize empty event store
        EventStore::create(db_path.to_str().unwrap())
            .await
            .map_err(std::io::Error::other)?;

        Ok(Self { temp_dir, db_path })
    }

    /// Open an existing .elf archive
    ///
    /// Extracts all files from the archive, including events.db and all block directories.
    pub fn open(elf_path: &Path) -> std::io::Result<Self> {
        let file = File::open(elf_path)?;
        let mut archive = ZipArchive::new(file)?;

        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("events.db");

        // Extract all files from zip
        for i in 0..archive.len() {
            let mut zip_file = archive.by_index(i)?;
            let zip_name = zip_file.name();

            // SECURITY: Sanitize zip entry path to prevent path traversal attacks
            if zip_name.contains("..") || Path::new(zip_name).is_absolute() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    format!("Invalid zip entry path: {}", zip_name),
                ));
            }

            let outpath = temp_dir.path().join(zip_name);

            // Create parent directory if needed
            let parent = outpath.parent().ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    format!("Invalid path in archive: {}", zip_name),
                )
            })?;
            std::fs::create_dir_all(parent)?;

            // Extract file
            if zip_file.is_file() {
                let mut outfile = File::create(&outpath)?;
                std::io::copy(&mut zip_file, &mut outfile)?;
            } else if zip_file.is_dir() {
                // Create directory
                std::fs::create_dir_all(&outpath)?;
            }
        }

        Ok(Self { temp_dir, db_path })
    }

    /// Get an EventPoolWithPath for reading/writing events
    pub async fn event_pool(&self) -> Result<EventPoolWithPath, sqlx::Error> {
        EventStore::create(self.db_path.to_str().unwrap()).await
    }

    /// Save the archive to a .elf file
    ///
    /// Recursively saves all files in temp_dir, including events.db and all block directories.
    pub fn save(&self, elf_path: &Path) -> std::io::Result<()> {
        let file = File::create(elf_path)?;
        let mut zip = ZipWriter::new(file);

        let options =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        let temp_path = self.temp_dir.path();

        // Recursively traverse temp_dir and save all files
        for entry in WalkDir::new(temp_path) {
            let entry = entry.map_err(|e| {
                std::io::Error::other(format!("Failed to traverse directory: {}", e))
            })?;

            let path = entry.path();

            // Skip directories, only process files
            if !path.is_file() {
                continue;
            }

            // Calculate relative path (relative to temp_path)
            let relative_path = path.strip_prefix(temp_path).map_err(|e| {
                std::io::Error::other(format!("Path not under temp_dir: {:?}: {}", path, e))
            })?;

            // Convert to string path (for zip internal path)
            let zip_path = relative_path.to_string_lossy();

            // Add file to zip using streaming I/O (avoids loading entire file into memory)
            zip.start_file(zip_path.as_ref(), options)?;
            let mut file = File::open(path)?;
            std::io::copy(&mut file, &mut zip)?;
        }

        zip.finish()?;
        Ok(())
    }

    /// Get the temporary directory path (useful for adding assets)
    pub fn temp_path(&self) -> &Path {
        self.temp_dir.path()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Event;
    use std::collections::HashMap;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_create_and_save() {
        let archive = ElfArchive::new().await.unwrap();
        let pool = archive.event_pool().await.unwrap();

        let mut timestamp = HashMap::new();
        timestamp.insert("editor1".to_string(), 1);

        let events = vec![Event::new(
            "block1".to_string(),
            "name".to_string(),
            serde_json::json!("Test Block"),
            timestamp,
        )];

        EventStore::append_events(&pool.pool, &events)
            .await
            .unwrap();

        let temp_elf = NamedTempFile::new().unwrap();
        archive.save(temp_elf.path()).unwrap();

        // Verify the file exists and is not empty
        let metadata = std::fs::metadata(temp_elf.path()).unwrap();
        assert!(metadata.len() > 0);
    }

    #[tokio::test]
    async fn test_open_and_read() {
        // Create and save an archive
        let archive = ElfArchive::new().await.unwrap();
        let pool = archive.event_pool().await.unwrap();

        let mut timestamp = HashMap::new();
        timestamp.insert("editor1".to_string(), 1);

        let events = vec![
            Event::new(
                "block1".to_string(),
                "name".to_string(),
                serde_json::json!("Block One"),
                timestamp.clone(),
            ),
            Event::new(
                "block1".to_string(),
                "type".to_string(),
                serde_json::json!("markdown"),
                timestamp.clone(),
            ),
        ];

        EventStore::append_events(&pool.pool, &events)
            .await
            .unwrap();

        let temp_elf = NamedTempFile::new().unwrap();
        archive.save(temp_elf.path()).unwrap();

        // Open the saved archive
        let opened = ElfArchive::open(temp_elf.path()).unwrap();
        let opened_pool = opened.event_pool().await.unwrap();

        let retrieved = EventStore::get_all_events(&opened_pool.pool).await.unwrap();
        assert_eq!(retrieved.len(), 2);
        assert_eq!(retrieved[0].entity, "block1");
        assert_eq!(retrieved[0].attribute, "name");
        assert_eq!(retrieved[1].attribute, "type");
    }

    #[tokio::test]
    async fn test_round_trip() {
        // Create -> Save -> Open -> Read should preserve data
        let archive1 = ElfArchive::new().await.unwrap();
        let pool1 = archive1.event_pool().await.unwrap();

        let mut timestamp = HashMap::new();
        timestamp.insert("editor1".to_string(), 5);

        let event = Event::new(
            "testblock".to_string(),
            "content".to_string(),
            serde_json::json!({"text": "Hello World"}),
            timestamp,
        );

        EventStore::append_events(&pool1.pool, &[event])
            .await
            .unwrap();

        let temp_elf = NamedTempFile::new().unwrap();
        archive1.save(temp_elf.path()).unwrap();

        let archive2 = ElfArchive::open(temp_elf.path()).unwrap();
        let pool2 = archive2.event_pool().await.unwrap();

        let events = EventStore::get_events_by_entity(&pool2.pool, "testblock")
            .await
            .unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].attribute, "content");
        assert_eq!(events[0].value["text"], "Hello World");
        assert_eq!(events[0].timestamp.get("editor1"), Some(&5));
    }

    #[tokio::test]
    async fn test_save_and_open_with_block_files() {
        // 测试：保存和重新打开应该保留所有block文件
        use std::fs;

        // 1. 创建archive
        let archive = ElfArchive::new().await.unwrap();
        let temp_path = archive.temp_path();

        // 2. 创建block目录和文件
        let block_dir = temp_path.join("block-test-123");
        fs::create_dir_all(&block_dir).unwrap();
        fs::write(block_dir.join("file1.txt"), "Hello").unwrap();
        fs::write(block_dir.join("file2.md"), "# World").unwrap();

        // 创建子目录
        let sub_dir = block_dir.join("subdir");
        fs::create_dir_all(&sub_dir).unwrap();
        fs::write(sub_dir.join("nested.json"), r#"{"key": "value"}"#).unwrap();

        // 3. 添加events到数据库
        let pool = archive.event_pool().await.unwrap();
        let mut timestamp = HashMap::new();
        timestamp.insert("editor1".to_string(), 1);
        let events = vec![Event::new(
            "block-test-123".to_string(),
            "test".to_string(),
            serde_json::json!({"data": "test"}),
            timestamp,
        )];
        EventStore::append_events(&pool.pool, &events)
            .await
            .unwrap();

        // 4. 保存到elf文件
        let temp_elf = NamedTempFile::new().unwrap();
        archive.save(temp_elf.path()).unwrap();

        // 5. 重新打开elf文件
        let opened = ElfArchive::open(temp_elf.path()).unwrap();
        let opened_temp = opened.temp_path();

        // 6. 验证文件都存在
        let opened_block_dir = opened_temp.join("block-test-123");
        assert!(opened_block_dir.exists(), "Block directory should exist");
        assert!(
            opened_block_dir.join("file1.txt").exists(),
            "file1.txt should exist"
        );
        assert!(
            opened_block_dir.join("file2.md").exists(),
            "file2.md should exist"
        );
        assert!(
            opened_block_dir.join("subdir/nested.json").exists(),
            "nested.json should exist"
        );

        // 7. 验证文件内容
        let content1 = fs::read_to_string(opened_block_dir.join("file1.txt")).unwrap();
        assert_eq!(content1, "Hello");

        let content2 = fs::read_to_string(opened_block_dir.join("file2.md")).unwrap();
        assert_eq!(content2, "# World");

        let content3 = fs::read_to_string(opened_block_dir.join("subdir/nested.json")).unwrap();
        assert_eq!(content3, r#"{"key": "value"}"#);

        // 8. 验证数据库也正常
        let opened_pool = opened.event_pool().await.unwrap();
        let retrieved_events = EventStore::get_all_events(&opened_pool.pool).await.unwrap();
        assert_eq!(retrieved_events.len(), 1);
        assert_eq!(retrieved_events[0].entity, "block-test-123");
    }

    #[tokio::test]
    async fn test_multiple_blocks_save_and_open() {
        // 测试：多个block目录都应该被保存和恢复
        use std::fs;

        let archive = ElfArchive::new().await.unwrap();
        let temp_path = archive.temp_path();

        // 创建多个block目录
        for i in 1..=3 {
            let block_dir = temp_path.join(format!("block-{}", i));
            fs::create_dir_all(&block_dir).unwrap();
            fs::write(block_dir.join("data.txt"), format!("Block {} data", i)).unwrap();
        }

        // 保存并重新打开
        let temp_elf = NamedTempFile::new().unwrap();
        archive.save(temp_elf.path()).unwrap();
        let opened = ElfArchive::open(temp_elf.path()).unwrap();

        // 验证所有block目录都存在
        for i in 1..=3 {
            let block_dir = opened.temp_path().join(format!("block-{}", i));
            assert!(block_dir.exists());
            let content = fs::read_to_string(block_dir.join("data.txt")).unwrap();
            assert_eq!(content, format!("Block {} data", i));
        }
    }

    #[tokio::test]
    async fn test_deep_nested_directories() {
        // 测试：深层嵌套目录应该正确保存和恢复
        use std::fs;

        let archive = ElfArchive::new().await.unwrap();
        let temp_path = archive.temp_path();

        let deep_path = temp_path
            .join("block-deep")
            .join("level1")
            .join("level2")
            .join("level3");
        fs::create_dir_all(&deep_path).unwrap();
        fs::write(deep_path.join("deep.txt"), "deep content").unwrap();

        let temp_elf = NamedTempFile::new().unwrap();
        archive.save(temp_elf.path()).unwrap();
        let opened = ElfArchive::open(temp_elf.path()).unwrap();

        let opened_deep = opened
            .temp_path()
            .join("block-deep")
            .join("level1")
            .join("level2")
            .join("level3")
            .join("deep.txt");
        assert!(opened_deep.exists());
        let content = fs::read_to_string(opened_deep).unwrap();
        assert_eq!(content, "deep content");
    }
}
