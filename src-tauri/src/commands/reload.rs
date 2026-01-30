//! EventStore Reload Commands
//!
//! Provides Tauri commands for reloading events from the EventStore.
//! This is needed when an external MCP process has written new events
//! to the same .elf file, and the GUI needs to refresh its in-memory state.

use crate::state::AppState;

/// Reload events from the EventStore for a specific file.
///
/// When an external MCP server (standalone mode) writes events to the same
/// .elf file's EventStore, the GUI's in-memory StateProjector becomes stale.
/// This command reloads all events and rebuilds the StateProjector.
///
/// # Arguments
/// * `file_id` - The file ID (path) to reload events for
///
/// # Returns
/// * `Ok(event_count)` - Number of events after reload
/// * `Err(String)` - Error message if reload failed
#[tauri::command]
#[specta::specta]
pub async fn reload_events(
    file_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, String> {
    // 1. Verify the file is open
    let _file_info = state
        .files
        .get(&file_id)
        .ok_or_else(|| format!("File not open: {}", file_id))?;

    // 2. Get the engine handle
    let handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("Engine not found for file: {}", file_id))?;

    // 3. Send reload message to the engine actor
    // The engine actor will re-read all events from SQLite and rebuild its StateProjector
    handle
        .reload_state()
        .await
        .map_err(|e| format!("Failed to reload events: {}", e))
}
