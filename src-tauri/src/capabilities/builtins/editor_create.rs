use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for editor.create capability.
///
/// Creates a new editor identity in the file.
/// This is a system-level operation that doesn't require a target block.
/// Any editor can create a new editor (no authorization check needed).
#[capability(id = "editor.create", target = "system")]
fn handle_editor_create(cmd: &Command, _block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Extract editor name from payload
    let name = cmd
        .payload
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'name' in payload")?;

    // Generate new editor ID
    let editor_id = uuid::Uuid::new_v4().to_string();

    // Create event with full editor data
    // Entity is the new editor_id
    let event = create_event(
        editor_id.clone(),
        "editor.create",
        serde_json::json!({
            "editor_id": editor_id,
            "name": name
        }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
