//! Terminal write command
//!
//! Writes user input data to an active PTY session.

use specta::specta;
use std::io::Write;
use tauri::State;

use super::permission::check_terminal_permission;
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
    // Verify permissions using capability system
    check_terminal_permission(
        &app_state,
        &payload.file_id,
        &payload.editor_id,
        &payload.block_id,
        "terminal.write",
    )
    .await?;

    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&payload.block_id) {
        write!(session.writer, "{}", payload.data)
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
    } else {
        return Err("Terminal session not found".to_string());
    }

    Ok(())
}
