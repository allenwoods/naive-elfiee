use crate::elf::ElfArchive;
use crate::state::{AppState, FileInfo};
use specta::specta;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;

/// Create a new .elf file and open it for editing.
///
/// # Arguments
/// * `path` - Absolute path where the new .elf file should be created
///
/// # Returns
/// * `Ok(file_id)` - Unique identifier for the opened file
/// * `Err(message)` - Error description if creation fails
#[tauri::command]
#[specta]
pub async fn create_file(
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Generate unique file ID
    let file_id = format!("file-{}", uuid::Uuid::new_v4());

    // Create new archive
    let archive = ElfArchive::new()
        .await
        .map_err(|e| format!("Failed to create archive: {}", e))?;

    // Save to specified path
    archive
        .save(Path::new(&path))
        .map_err(|e| format!("Failed to save file: {}", e))?;

    // Get event pool for this archive
    let event_pool = archive
        .event_pool()
        .await
        .map_err(|e| format!("Failed to get event pool: {}", e))?;

    // Spawn engine actor for this file
    state
        .engine_manager
        .spawn_engine(file_id.clone(), event_pool)
        .await?;

    // Store file info
    state.files.insert(
        file_id.clone(),
        FileInfo {
            archive: Arc::new(archive),
            path: PathBuf::from(&path),
        },
    );

    Ok(file_id)
}

/// Open an existing .elf file for editing.
///
/// # Arguments
/// * `path` - Absolute path to the .elf file to open
///
/// # Returns
/// * `Ok(file_id)` - Unique identifier for the opened file
/// * `Err(message)` - Error description if opening fails
#[tauri::command]
#[specta]
pub async fn open_file(
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Generate unique file ID
    let file_id = format!("file-{}", uuid::Uuid::new_v4());

    // Open existing archive
    let archive = ElfArchive::open(Path::new(&path))
        .map_err(|e| format!("Failed to open file: {}", e))?;

    // Get event pool for this archive
    let event_pool = archive
        .event_pool()
        .await
        .map_err(|e| format!("Failed to get event pool: {}", e))?;

    // Spawn engine actor for this file
    state
        .engine_manager
        .spawn_engine(file_id.clone(), event_pool)
        .await?;

    // Store file info
    state.files.insert(
        file_id.clone(),
        FileInfo {
            archive: Arc::new(archive),
            path: PathBuf::from(&path),
        },
    );

    Ok(file_id)
}

/// Save the current state of a file to disk.
///
/// This persists all changes made since the file was opened or last saved.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file to save
///
/// # Returns
/// * `Ok(())` - File saved successfully
/// * `Err(message)` - Error description if save fails
#[tauri::command]
#[specta]
pub async fn save_file(
    file_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Get file info
    let file_info = state
        .files
        .get(&file_id)
        .ok_or_else(|| format!("File '{}' not found", file_id))?;

    // Save to original path
    file_info
        .archive
        .save(&file_info.path)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(())
}

/// Close a file and release associated resources.
///
/// This shuts down the engine actor and removes the file from memory.
/// Unsaved changes will be lost.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file to close
///
/// # Returns
/// * `Ok(())` - File closed successfully
/// * `Err(message)` - Error description if close fails
#[tauri::command]
#[specta]
pub async fn close_file(
    file_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Shutdown engine actor
    state.engine_manager.shutdown_engine(&file_id).await?;

    // Remove file info
    state.files.remove(&file_id);

    Ok(())
}

/// Get list of all currently open files.
///
/// # Returns
/// * `Ok(Vec<file_id>)` - List of file IDs currently open
/// * `Err(message)` - Error description if retrieval fails
#[tauri::command]
#[specta]
pub async fn list_open_files(
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let file_ids: Vec<String> = state
        .files
        .iter()
        .map(|entry| entry.key().clone())
        .collect();

    Ok(file_ids)
}
