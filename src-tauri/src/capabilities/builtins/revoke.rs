use crate::capabilities::core::{CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for core.revoke capability.
///
/// Revokes a capability from an editor for a specific block (or wildcard).
#[capability(id = "core.revoke", target = "core/*")]
fn handle_revoke(cmd: &Command, _block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Extract target editor
    let target_editor = cmd.payload.get("target_editor")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'target_editor' in payload")?;

    // Extract capability to revoke
    let revoke_cap_id = cmd.payload.get("capability")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'capability' in payload")?;

    // Extract target block (optional, defaults to wildcard)
    let target_block = cmd.payload.get("target_block")
        .and_then(|v| v.as_str())
        .unwrap_or("*");

    // Create revoke event
    // Entity is the revoker's editor_id
    let event = create_event(
        cmd.editor_id.clone(),
        "core.revoke",  // cap_id
        serde_json::json!({
            "editor": target_editor,
            "capability": revoke_cap_id,
            "block": target_block,
        }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
