//! terminal.execute capability
//!
//! Records command execution events in the terminal.
//! This capability is called when a command is executed (e.g., on Enter key)
//! to create an event log of all commands run in the terminal session.
//!
//! NOTE: This capability only produces Events. The actual command execution
//! happens in the PTY, which is managed separately.

use capability_macros::capability;

use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use crate::utils::now_utc;

use super::TerminalExecutePayload;

/// Handler for terminal.execute capability.
///
/// Records a command execution event for audit/history purposes.
/// The event contains the command text, timestamp, and exit code if available.
///
/// # Payload
/// Uses `TerminalExecutePayload` with:
/// - `command`: The command string that was executed
/// - `exit_code`: Optional exit code of the command (may not be available immediately)
#[capability(id = "terminal.execute", target = "terminal")]
fn handle_terminal_execute(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for terminal.execute")?;

    if block.block_type != "terminal" {
        return Err(format!(
            "Expected block_type 'terminal', got '{}'",
            block.block_type
        ));
    }

    // Deserialize strongly-typed payload
    let payload: TerminalExecutePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for terminal.execute: {}", e))?;

    // Create command execution event
    let event = create_event(
        block.block_id.clone(),
        "terminal.execute",
        serde_json::json!({
            "command": payload.command,
            "executed_at": now_utc(),
            "exit_code": payload.exit_code,
        }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count
    );

    Ok(vec![event])
}
