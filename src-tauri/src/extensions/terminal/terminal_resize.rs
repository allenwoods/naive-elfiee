//! Terminal resize command
//!
//! Resizes an active PTY session window.

use portable_pty::PtySize;
use specta::specta;
use tauri::State;

use super::permission::check_terminal_permission;
use super::state::TerminalState;
use super::TerminalResizePayload;
use crate::state::AppState;

/// Resize the PTY.
///
/// This command updates the PTY window dimensions when the frontend
/// terminal viewport changes size.
///
/// # Arguments
/// * `state` - Terminal state containing active sessions
/// * `app_state` - Application state for permission checking
/// * `payload` - Resize parameters (cols, rows, block_id, file_id, editor_id)
///
/// # Returns
/// * `Ok(())` - PTY resized successfully
/// * `Err(String)` - Error if session not found or resize fails
#[tauri::command]
#[specta]
pub async fn resize_pty(
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    payload: TerminalResizePayload,
) -> Result<(), String> {
    // Verify permissions using capability system
    check_terminal_permission(
        &app_state,
        &payload.file_id,
        &payload.editor_id,
        &payload.block_id,
        "terminal.resize",
    )
    .await?;

    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&payload.block_id) {
        session
            .master
            .resize(PtySize {
                rows: payload.rows,
                cols: payload.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
    } else {
        return Err("Terminal session not found".to_string());
    }

    Ok(())
}
