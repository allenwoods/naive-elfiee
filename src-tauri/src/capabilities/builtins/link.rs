use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event, LinkBlockPayload};
use capability_macros::capability;

/// Handler for core.link capability.
///
/// Links two blocks together by adding a relation to the block's children.
#[capability(id = "core.link", target = "core/*")]
fn handle_link(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for core.link")?;

    // Strongly-typed deserialization
    let payload: LinkBlockPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for core.link: {}", e))?;

    // Update children HashMap
    let mut new_children = block.children.clone();
    new_children
        .entry(payload.relation)
        .or_default()
        .push(payload.target_id);

    // Create event
    let event = create_event(
        block.block_id.clone(),
        "core.link", // cap_id
        serde_json::json!({ "children": new_children }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count (actor.rs:227)
    );

    Ok(vec![event])
}
