use crate::capabilities::core::{CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for core.delete capability.
///
/// Soft-deletes a block by marking it as deleted.
#[capability(id = "core.delete", target = "core/*")]
fn handle_delete(cmd: &Command, block: &Block) -> CapResult<Vec<Event>> {
    // Create event marking block as deleted
    let event = create_event(
        block.block_id.clone(),
        "deleted".to_string(),
        serde_json::json!(true),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
