use crate::capabilities::core::CapResult;
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for core.read capability.
///
/// This capability grants permission to read a block's metadata, events, and grants.
/// It is a meta-capability that controls access to block information beyond content.
///
/// # Scope
/// - Read block metadata (description, timestamps, custom fields)
/// - Read block events (history, timeline)
/// - Read block grants (collaborators, permissions)
///
/// # Relationship with content read capabilities
/// - `markdown.read`, `code.read`, `directory.read` grant content access
/// - `core.read` grants metadata/history access
/// - Users with any permission on a block (read/write/delete) implicitly have `core.read`
/// - `core.read` can be granted standalone for metadata-only access
///
/// # Handler Behavior
/// This is a pure permission capability - it does not generate events.
/// The handler always succeeds if authorization passes.
#[capability(id = "core.read", target = "core/*")]
fn handle_read(_cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Verify block exists (certificator already checked permissions)
    let _block = block.ok_or("Block required for core.read")?;

    // No events generated - this is a read-only permission check
    Ok(vec![])
}
