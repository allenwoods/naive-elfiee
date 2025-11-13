use crate::engine::EventStore;
use sqlx::SqlitePool;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tempfile::TempDir;
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
    pub fn open(elf_path: &Path) -> std::io::Result<Self> {
        let file = File::open(elf_path)?;
        let mut archive = ZipArchive::new(file)?;

        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("events.db");

        // Extract events.db from the archive
        let mut db_file = archive.by_name("events.db")?;
        let mut buffer = Vec::new();
        db_file.read_to_end(&mut buffer)?;

        let mut output = File::create(&db_path)?;
        output.write_all(&buffer)?;

        Ok(Self { temp_dir, db_path })
    }

    /// Get a SqlitePool for reading/writing events
    pub async fn event_pool(&self) -> Result<SqlitePool, sqlx::Error> {
        EventStore::create(self.db_path.to_str().unwrap()).await
    }

    /// Save the archive to a .elf file
    pub fn save(&self, elf_path: &Path) -> std::io::Result<()> {
        let file = File::create(elf_path)?;
        let mut zip = ZipWriter::new(file);

        let options =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        // Add events.db to the archive
        zip.start_file("events.db", options)?;
        let mut db_file = File::open(&self.db_path)?;
        let mut buffer = Vec::new();
        db_file.read_to_end(&mut buffer)?;
        zip.write_all(&buffer)?;

        // Add all additional files from temp directory
        self.add_directory_to_zip(&mut zip, self.temp_dir.path(), "")?;

        zip.finish()?;
        Ok(())
    }

    /// Helper method to add directory contents to zip
    fn add_directory_to_zip(&self, zip: &mut ZipWriter<File>, dir_path: &Path, zip_prefix: &str) -> std::io::Result<()> {
        let options = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        
        for entry in std::fs::read_dir(dir_path)? {
            let entry = entry?;
            let path = entry.path();
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            
            // Skip events.db as it's already handled
            if name_str == "events.db" {
                continue;
            }
            
            let zip_path = if zip_prefix.is_empty() {
                name_str.to_string()
            } else {
                format!("{}/{}", zip_prefix, name_str)
            };
            
            if path.is_file() {
                zip.start_file(&zip_path, options)?;
                let mut file = File::open(&path)?;
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)?;
                zip.write_all(&buffer)?;
            } else if path.is_dir() {
                self.add_directory_to_zip(zip, &path, &zip_path)?;
            }
        }
        
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

        EventStore::append_events(&pool, &events).await.unwrap();

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

        EventStore::append_events(&pool, &events).await.unwrap();

        let temp_elf = NamedTempFile::new().unwrap();
        archive.save(temp_elf.path()).unwrap();

        // Open the saved archive
        let opened = ElfArchive::open(temp_elf.path()).unwrap();
        let opened_pool = opened.event_pool().await.unwrap();

        let retrieved = EventStore::get_all_events(&opened_pool).await.unwrap();
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

        EventStore::append_events(&pool1, &[event]).await.unwrap();

        let temp_elf = NamedTempFile::new().unwrap();
        archive1.save(temp_elf.path()).unwrap();

        let archive2 = ElfArchive::open(temp_elf.path()).unwrap();
        let pool2 = archive2.event_pool().await.unwrap();

        let events = EventStore::get_events_by_entity(&pool2, "testblock")
            .await
            .unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].attribute, "content");
        assert_eq!(events[0].value["text"], "Hello World");
        assert_eq!(events[0].timestamp.get("editor1"), Some(&5));
    }
}
