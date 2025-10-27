use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for core.create capability.
///
/// Creates a new block with name, type, and owner.
/// Note: The block parameter is None for create since the block doesn't exist yet.
#[capability(id = "core.create", target = "core/*")]
fn handle_create(cmd: &Command, _block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Extract block name
    let name = cmd
        .payload
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'name' in payload")?;

    // Extract block type
    let block_type = cmd
        .payload
        .get("block_type")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'block_type' in payload")?;

    // Generate new block ID
    let block_id = uuid::Uuid::new_v4().to_string();

    // Create a single event with full initial state
    // Per README.md Part 2: create events contain the full initial state
    let event = create_event(
        block_id.clone(),
        "core.create", // cap_id
        serde_json::json!({
            "name": name,
            "type": block_type,
            "owner": cmd.editor_id,
            "contents": {},
            "children": {}
        }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count from state
    );

    Ok(vec![event])
}
