//! Terminal resize command
//!
//! Resizes an active PTY session window.

use portable_pty::PtySize;
use specta::specta;
use tauri::State;

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
    // Verify permissions using capability system via EngineHandle
    let engine = app_state
        .engine_manager
        .get_engine(&payload.file_id)
        .ok_or_else(|| format!("File '{}' is not open", payload.file_id))?;

    let authorized = engine
        .check_grant(
            payload.editor_id.clone(),
            "terminal.resize".to_string(),
            payload.block_id.clone(),
        )
        .await;

    if !authorized {
        return Err(format!(
            "Authorization failed: {} does not have permission for terminal.resize on block {}",
            payload.editor_id, payload.block_id
        ));
    }

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
