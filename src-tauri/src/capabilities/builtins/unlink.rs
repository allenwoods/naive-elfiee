use crate::capabilities::core::{CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for core.unlink capability.
///
/// Removes a link between two blocks by removing the target from the relation.
#[capability(id = "core.unlink", target = "core/*")]
fn handle_unlink(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for core.unlink")?;
    // Extract relation type
    let relation = cmd.payload.get("relation")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'relation' in payload")?;

    // Extract target block ID to remove
    let target_id = cmd.payload.get("target_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'target_id' in payload")?;

    // Update children HashMap - remove the target
    let mut new_children = block.children.clone();
    if let Some(targets) = new_children.get_mut(relation) {
        targets.retain(|id| id != target_id);
        // Remove the relation key if no targets left
        if targets.is_empty() {
            new_children.remove(relation);
        }
    }

    // Create event
    let event = create_event(
        block.block_id.clone(),
        "core.unlink",  // cap_id
        serde_json::json!({ "children": new_children }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
