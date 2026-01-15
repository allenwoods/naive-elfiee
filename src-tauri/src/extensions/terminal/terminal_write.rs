//! Terminal write command
//!
//! Writes user input data to an active PTY session.

use specta::specta;
use std::io::Write;
use tauri::State;

use super::state::TerminalState;
use super::TerminalWritePayload;
use crate::state::AppState;

/// Write data to the PTY.
///
/// This command forwards user input from the frontend terminal (xterm.js)
/// to the backend PTY process.
///
/// # Arguments
/// * `state` - Terminal state containing active sessions
/// * `app_state` - Application state for permission checking
/// * `payload` - Write parameters (data, block_id, file_id, editor_id)
///
/// # Returns
/// * `Ok(())` - Data written successfully
/// * `Err(String)` - Error if session not found or write fails
#[tauri::command]
#[specta]
pub async fn write_to_pty(
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    payload: TerminalWritePayload,
) -> Result<(), String> {
    // Verify permissions using capability system via EngineHandle
    let engine = app_state
        .engine_manager
        .get_engine(&payload.file_id)
        .ok_or_else(|| format!("File '{}' is not open", payload.file_id))?;

    let authorized = engine
        .check_grant(
            payload.editor_id.clone(),
            "terminal.write".to_string(),
            payload.block_id.clone(),
        )
        .await;

    if !authorized {
        return Err(format!(
            "Authorization failed: {} does not have permission for terminal.write on block {}",
            payload.editor_id, payload.block_id
        ));
    }

    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&payload.block_id) {
        write!(session.writer, "{}", payload.data)
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
    } else {
        return Err("Terminal session not found".to_string());
    }

    Ok(())
}
