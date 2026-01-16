//! terminal.init Capability
//!
//! Authorization capability for terminal initialization.
//! The actual PTY creation is handled by the Tauri command in `commands/terminal.rs`.

use crate::capabilities::core::CapResult;
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for terminal.init capability.
///
/// This capability performs authorization check for terminal initialization.
/// It acts as a permission gate - if this handler succeeds, the caller is
/// authorized to initialize a PTY session.
///
/// # Architecture Note
/// In Elfiee's split architecture:
/// 1. **Capability Handler** (this file): Performs authorization check
/// 2. **Tauri Command** (`commands/terminal.rs`): Performs actual PTY operations
///
/// # Arguments
/// * `cmd` - The command containing initialization parameters
/// * `block` - The terminal block (must exist and be of type "terminal")
///
/// # Returns
/// * `Ok(Vec<Event>)` - Empty vector (authorization passed, no events generated)
/// * `Err(String)` - Error if block is missing or invalid
#[capability(id = "terminal.init", target = "terminal")]
fn handle_terminal_init(_cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for terminal.init")?;

    if block.block_type != "terminal" {
        return Err(format!(
            "Expected block_type 'terminal', got '{}'",
            block.block_type
        ));
    }

    // Authorization is handled by the engine before calling this handler.
    // If we reach here, the caller is authorized.
    // Return empty events - no state change for initialization permission check.
    Ok(vec![])
}
