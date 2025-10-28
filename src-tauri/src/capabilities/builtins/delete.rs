use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for core.delete capability.
///
/// Soft-deletes a block by marking it as deleted.
#[capability(id = "core.delete", target = "core/*")]
fn handle_delete(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for core.delete")?;
    // Create event marking block as deleted
    let event = create_event(
        block.block_id.clone(),
        "core.delete", // cap_id
        serde_json::json!({ "deleted": true }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
