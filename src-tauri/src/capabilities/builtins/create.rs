use crate::capabilities::core::{CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for core.create capability.
///
/// Creates a new block with name, type, and owner.
/// Note: The block parameter is a placeholder for create operations.
#[capability(id = "core.create", target = "core/*")]
fn handle_create(cmd: &Command, _block: &Block) -> CapResult<Vec<Event>> {
    // Extract block name
    let name = cmd.payload.get("name")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'name' in payload")?;

    // Extract block type
    let block_type = cmd.payload.get("block_type")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'block_type' in payload")?;

    // Generate new block ID
    let block_id = uuid::Uuid::new_v4().to_string();

    // Create events for the new block
    let events = vec![
        create_event(
            block_id.clone(),
            "name".to_string(),
            serde_json::json!(name),
            &cmd.editor_id,
            1, // TODO: Replace with actual vector clock count from state
        ),
        create_event(
            block_id.clone(),
            "type".to_string(),
            serde_json::json!(block_type),
            &cmd.editor_id,
            1,
        ),
        create_event(
            block_id.clone(),
            "owner".to_string(),
            serde_json::json!(cmd.editor_id),
            &cmd.editor_id,
            1,
        ),
    ];

    Ok(events)
}
