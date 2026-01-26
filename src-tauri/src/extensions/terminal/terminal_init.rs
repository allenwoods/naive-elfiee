//! terminal.init capability
//!
//! Generates Event for terminal session initialization.
//!
//! ## Architecture Note
//!
//! Actual PTY creation is handled by the Tauri command (`async_init_terminal`)
//! because it requires access to Tauri State. This capability only:
//! 1. Validates the block is a terminal block
//! 2. Generates an event recording that the session was started
//!
//! The Tauri command calls this capability first for authorization,
//! then performs the actual PTY creation.

use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use crate::utils::time::now_utc;
use capability_macros::capability;

/// Handler for terminal.init capability.
///
/// Generates an event recording that a terminal session was initialized.
/// The actual PTY creation is handled by the Tauri command.
#[capability(id = "terminal.init", target = "terminal")]
fn handle_terminal_init(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for terminal.init")?;

    if block.block_type != "terminal" {
        return Err(format!(
            "Expected block_type 'terminal', got '{}'",
            block.block_type
        ));
    }

    // Generate event for session initialization
    let event = create_event(
        block.block_id.clone(),
        "terminal.init",
        serde_json::json!({
            "session_started": true,
            "started_at": now_utc(),
        }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count
    );

    Ok(vec![event])
}
