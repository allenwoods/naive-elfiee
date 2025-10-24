use crate::elf::ElfArchive;
use crate::engine::EngineManager;
use dashmap::DashMap;
use std::path::PathBuf;
use std::sync::Arc;

/// Information about an open file
pub struct FileInfo {
    pub archive: Arc<ElfArchive>,
    pub path: PathBuf,
}

/// Application state shared across all Tauri commands.
///
/// This state manages multiple open .elf files and their corresponding engine actors.
/// Each file has a unique file_id and is managed independently.
pub struct AppState {
    /// Engine manager for processing commands on .elf files
    pub engine_manager: EngineManager,

    /// Map of file_id -> FileInfo for open files
    /// Using DashMap for thread-safe concurrent access
    pub files: Arc<DashMap<String, FileInfo>>,
}

impl AppState {
    /// Create a new application state with empty file list.
    pub fn new() -> Self {
        Self {
            engine_manager: EngineManager::new(),
            files: Arc::new(DashMap::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
