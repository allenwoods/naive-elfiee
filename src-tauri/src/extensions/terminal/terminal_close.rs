//! terminal.close capability
//!
//! Generates Event for terminal session closure.
//!
//! ## Architecture Note
//!
//! Actual PTY cleanup is handled by the Tauri command (`close_terminal_session`)
//! because it requires access to Tauri State. This capability only:
//! 1. Validates the block is a terminal block
//! 2. Generates an event recording that the session was closed
//!
//! The Tauri command calls this capability first for authorization,
//! then performs the actual PTY cleanup.

use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use crate::utils::time::now_utc;
use capability_macros::capability;

/// Handler for terminal.close capability.
///
/// Generates an event recording that a terminal session was closed.
/// The actual PTY cleanup is handled by the Tauri command.
#[capability(id = "terminal.close", target = "terminal")]
fn handle_terminal_close(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for terminal.close")?;

    if block.block_type != "terminal" {
        return Err(format!(
            "Expected block_type 'terminal', got '{}'",
            block.block_type
        ));
    }

    // Generate event for session closure
    let event = create_event(
        block.block_id.clone(),
        "terminal.close",
        serde_json::json!({
            "session_closed": true,
            "closed_at": now_utc(),
        }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count
    );

    Ok(vec![event])
}
