use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, CreateBlockPayload, Event};
use capability_macros::capability;

/// Handler for core.create capability.
///
/// Creates a new block with name, type, and owner.
/// Note: The block parameter is None for create since the block doesn't exist yet.
#[capability(id = "core.create", target = "core/*")]
fn handle_create(cmd: &Command, _block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Strongly-typed deserialization
    let payload: CreateBlockPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for core.create: {}", e))?;

    // Generate new block ID
    let block_id = uuid::Uuid::new_v4().to_string();

    // Create a single event with full initial state
    // Per README.md Part 2: create events contain the full initial state
    let event = create_event(
        block_id.clone(),
        "core.create", // cap_id
        serde_json::json!({
            "name": payload.name,
            "type": payload.block_type,
            "owner": cmd.editor_id,
            "contents": {},
            "children": {}
        }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count (actor.rs:227)
    );

    Ok(vec![event])
}
