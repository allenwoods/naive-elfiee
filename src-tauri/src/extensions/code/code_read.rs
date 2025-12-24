use crate::capabilities::core::CapResult;
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for code.read capability.
///
/// Reads the text content from a code block's contents field.
///
/// # Returns
/// * `Ok(Vec<Event>)` - Empty vector (read operations are side-effect free)
#[capability(id = "code.read", target = "code")]
fn handle_code_read(_cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let _block = block.ok_or("Block required for code.read")?;

    // In Elfiee architecture, the actual data retrieval happens at the query layer.
    // The capability handler's primary role for read-only ops is authorization.
    // Since authorization is handled by the actor/engine before calling this handler,
    // we simply return success.

    Ok(vec![])
}
