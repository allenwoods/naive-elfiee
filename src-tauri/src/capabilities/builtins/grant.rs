use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event, GrantPayload};
use capability_macros::capability;

/// Handler for core.grant capability.
///
/// Grants a capability to an editor for a specific block (or wildcard).
#[capability(id = "core.grant", target = "core/*")]
fn handle_grant(cmd: &Command, _block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Strongly-typed deserialization
    let payload: GrantPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for core.grant: {}", e))?;

    // Create grant event
    // Entity is the granter's editor_id per README.md Part 2
    let event = create_event(
        cmd.editor_id.clone(),
        "core.grant", // cap_id
        serde_json::json!({
            "editor": payload.target_editor,
            "capability": payload.capability,
            "block": payload.target_block,
        }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
