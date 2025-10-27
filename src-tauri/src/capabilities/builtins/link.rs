use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for core.link capability.
///
/// Links two blocks together by adding a relation to the block's children.
#[capability(id = "core.link", target = "core/*")]
fn handle_link(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for core.link")?;
    // Extract relation type
    let relation = cmd
        .payload
        .get("relation")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'relation' in payload")?;

    // Extract target block ID
    let target_id = cmd
        .payload
        .get("target_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'target_id' in payload")?;

    // Update children HashMap
    let mut new_children = block.children.clone();
    new_children
        .entry(relation.to_string())
        .or_default()
        .push(target_id.to_string());

    // Create event
    let event = create_event(
        block.block_id.clone(),
        "core.link", // cap_id
        serde_json::json!({ "children": new_children }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
