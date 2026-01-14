//! Terminal close command
//!
//! Closes an active PTY session and cleans up resources.

use specta::specta;
use tauri::State;

use super::permission::check_terminal_permission;
use super::state::TerminalState;
use crate::state::AppState;

/// Close a PTY session.
///
/// This command:
/// 1. Verifies the editor has permission for terminal.close
/// 2. Signals the reader thread to stop
/// 3. Removes the session from state
/// 4. Drops the PTY resources (which terminates the child process)
///
/// Note: Content saving should be handled by the frontend before calling this.
/// The frontend has access to the xterm.js buffer and should call terminal.save
/// capability before closing the session.
///
/// # Arguments
/// * `state` - Terminal state containing active sessions
/// * `app_state` - Application state for permission checking
/// * `file_id` - The file containing the terminal block
/// * `block_id` - The terminal block being closed
/// * `editor_id` - The editor closing the session
///
/// # Returns
/// * `Ok(())` - Session closed successfully (or was already closed)
/// * `Err(String)` - Error if permission check fails
#[tauri::command]
#[specta]
pub async fn close_terminal_session(
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    file_id: String,
    block_id: String,
    editor_id: String,
) -> Result<(), String> {
    // Verify permissions using capability system
    check_terminal_permission(
        &app_state,
        &file_id,
        &editor_id,
        &block_id,
        "terminal.close",
    )
    .await?;

    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.remove(&block_id) {
        // Signal the reader thread to stop
        let _ = session.shutdown_tx.send(());

        // Dropping the session will drop the master PTY, which should terminate the child process
        drop(session);
    }
    Ok(())
}
