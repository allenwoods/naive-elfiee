use crate::capabilities::core::{CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for core.grant capability.
///
/// Grants a capability to an editor for a specific block (or wildcard).
#[capability(id = "core.grant", target = "core/*")]
fn handle_grant(cmd: &Command, _block: &Block) -> CapResult<Vec<Event>> {
    // Extract target editor
    let target_editor = cmd.payload.get("target_editor")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'target_editor' in payload")?;

    // Extract capability to grant
    let grant_cap_id = cmd.payload.get("capability")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'capability' in payload")?;

    // Extract target block (optional, defaults to wildcard)
    let target_block = cmd.payload.get("target_block")
        .and_then(|v| v.as_str())
        .unwrap_or("*");

    // Create grant entity ID
    let grant_entity = format!("grant:{}:{}:{}", target_editor, grant_cap_id, target_block);

    // Create grant event
    let event = create_event(
        grant_entity,
        "grant".to_string(),
        serde_json::json!({
            "editor": target_editor,
            "capability": grant_cap_id,
            "block": target_block,
        }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
