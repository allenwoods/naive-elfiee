use crate::elf::ElfArchive;
use crate::models::Command;
use crate::state::{AppState, FileInfo};
use specta::specta;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;

/// Bootstrap the editor system for a file.
///
/// If no editors exist, creates a "system" editor and sets it as active.
/// If editors exist but no active editor is set, sets the first editor as active.
/// This ensures every file always has at least one editor available and selected.
async fn bootstrap_editors(file_id: &str, state: &AppState) -> Result<(), String> {
    // Get engine handle
    let handle = state
        .engine_manager
        .get_engine(file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Check if any editors exist
    let editors = handle.get_all_editors().await;

    if editors.is_empty() {
        // Create system editor
        let cmd = Command::new(
            "system".to_string(),
            "editor.create".to_string(),
            "".to_string(),
            serde_json::json!({ "name": "System" }),
        );

        let events = handle.process_command(cmd).await?;

        // Extract editor_id from created event
        if let Some(event) = events.first() {
            let system_editor_id = event.entity.clone();

            // Set as active editor
            state.set_active_editor(file_id.to_string(), system_editor_id);
        }
    } else {
        // Editors exist - ensure one is set as active
        // This handles the case of reopening a file where activeEditorId is not persisted
        if state.get_active_editor(file_id).is_none() {
            // Set the first editor as active (deterministic choice)
            if let Some((first_editor_id, _)) = editors.iter().next() {
                state.set_active_editor(file_id.to_string(), first_editor_id.clone());
            }
        }
    }

    Ok(())
}

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
pub async fn create_file(path: String, state: State<'_, AppState>) -> Result<String, String> {
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

    // Bootstrap editors (create system editor if none exist)
    bootstrap_editors(&file_id, &state).await?;

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
pub async fn open_file(path: String, state: State<'_, AppState>) -> Result<String, String> {
    // Generate unique file ID
    let file_id = format!("file-{}", uuid::Uuid::new_v4());

    // Open existing archive
    let archive =
        ElfArchive::open(Path::new(&path)).map_err(|e| format!("Failed to open file: {}", e))?;

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

    // Bootstrap editors (create system editor if none exist)
    bootstrap_editors(&file_id, &state).await?;

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
pub async fn save_file(file_id: String, state: State<'_, AppState>) -> Result<(), String> {
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
pub async fn close_file(file_id: String, state: State<'_, AppState>) -> Result<(), String> {
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
pub async fn list_open_files(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let file_ids: Vec<String> = state
        .files
        .iter()
        .map(|entry| entry.key().clone())
        .collect();

    Ok(file_ids)
}

/// Get all events for a specific file.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file
///
/// # Returns
/// * `Ok(Vec<Event>)` - List of all events for the file
/// * `Err(message)` - Error description if retrieval fails
#[tauri::command]
#[specta]
pub async fn get_all_events(file_id: String, state: State<'_, AppState>) -> Result<Vec<crate::models::Event>, String> {
    // Get engine handle
    let handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Get all events from the engine
    handle.get_all_events().await
}
