//! terminal.close Capability
//!
//! Authorization capability for terminal close operations.
//! The actual PTY cleanup is handled by the Tauri command in `commands/terminal.rs`.

use crate::capabilities::core::CapResult;
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for terminal.close capability.
///
/// This capability performs authorization check for closing a terminal session.
/// It acts as a permission gate - if this handler succeeds, the caller is
/// authorized to close the PTY session.
///
/// # Architecture Note
/// In Elfiee's split architecture:
/// 1. **Capability Handler** (this file): Performs authorization check
/// 2. **Tauri Command** (`commands/terminal.rs`): Performs actual PTY cleanup
///
/// # Arguments
/// * `cmd` - The command containing close parameters
/// * `block` - The terminal block (must exist and be of type "terminal")
///
/// # Returns
/// * `Ok(Vec<Event>)` - Empty vector (authorization passed, no events generated)
/// * `Err(String)` - Error if block is missing or invalid
#[capability(id = "terminal.close", target = "terminal")]
fn handle_terminal_close(_cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for terminal.close")?;

    if block.block_type != "terminal" {
        return Err(format!(
            "Expected block_type 'terminal', got '{}'",
            block.block_type
        ));
    }

    // Authorization is handled by the engine before calling this handler.
    // Return empty events - no state change for close permission check.
    Ok(vec![])
}
