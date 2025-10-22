use crate::engine::EventStore;
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
    pub fn new() -> std::io::Result<Self> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("events.db");

        // Initialize empty event store
        EventStore::new(db_path.to_str().unwrap())
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

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

    /// Get the EventStore for reading/writing events
    pub fn event_store(&self) -> Result<EventStore, rusqlite::Error> {
        EventStore::new(self.db_path.to_str().unwrap())
    }

    /// Save the archive to a .elf file
    pub fn save(&self, elf_path: &Path) -> std::io::Result<()> {
        let file = File::create(elf_path)?;
        let mut zip = ZipWriter::new(file);

        let options = zip::write::FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        // Add events.db to the archive
        zip.start_file("events.db", options)?;
        let mut db_file = File::open(&self.db_path)?;
        let mut buffer = Vec::new();
        db_file.read_to_end(&mut buffer)?;
        zip.write_all(&buffer)?;

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

    #[test]
    fn test_create_and_save() {
        let archive = ElfArchive::new().unwrap();
        let store = archive.event_store().unwrap();

        let mut timestamp = HashMap::new();
        timestamp.insert("editor1".to_string(), 1);

        let events = vec![Event::new(
            "block1".to_string(),
            "name".to_string(),
            serde_json::json!("Test Block"),
            timestamp,
        )];

        store.append_events(&events).unwrap();

        let temp_elf = NamedTempFile::new().unwrap();
        archive.save(temp_elf.path()).unwrap();

        // Verify the file exists and is not empty
        let metadata = std::fs::metadata(temp_elf.path()).unwrap();
        assert!(metadata.len() > 0);
    }

    #[test]
    fn test_open_and_read() {
        // Create and save an archive
        let archive = ElfArchive::new().unwrap();
        let store = archive.event_store().unwrap();

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

        store.append_events(&events).unwrap();

        let temp_elf = NamedTempFile::new().unwrap();
        archive.save(temp_elf.path()).unwrap();

        // Open the saved archive
        let opened = ElfArchive::open(temp_elf.path()).unwrap();
        let opened_store = opened.event_store().unwrap();

        let retrieved = opened_store.get_all_events().unwrap();
        assert_eq!(retrieved.len(), 2);
        assert_eq!(retrieved[0].entity, "block1");
        assert_eq!(retrieved[0].attribute, "name");
        assert_eq!(retrieved[1].attribute, "type");
    }

    #[test]
    fn test_round_trip() {
        // Create -> Save -> Open -> Read should preserve data
        let archive1 = ElfArchive::new().unwrap();
        let store1 = archive1.event_store().unwrap();

        let mut timestamp = HashMap::new();
        timestamp.insert("editor1".to_string(), 5);

        let event = Event::new(
            "testblock".to_string(),
            "content".to_string(),
            serde_json::json!({"text": "Hello World"}),
            timestamp,
        );

        store1.append_events(&[event]).unwrap();

        let temp_elf = NamedTempFile::new().unwrap();
        archive1.save(temp_elf.path()).unwrap();

        let archive2 = ElfArchive::open(temp_elf.path()).unwrap();
        let store2 = archive2.event_store().unwrap();

        let events = store2.get_events_by_entity("testblock").unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].attribute, "content");
        assert_eq!(events[0].value["text"], "Hello World");
        assert_eq!(events[0].timestamp.get("editor1"), Some(&5));
    }
}
