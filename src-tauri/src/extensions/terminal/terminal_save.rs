use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

use super::TerminalSavePayload;

/// Handler for terminal.save capability.
///
/// Saves terminal content (buffer snapshot) to a terminal block's contents field.
/// The content is stored under the "saved_content" and "saved_at" keys in the contents HashMap.
///
/// # Payload
/// Uses `TerminalSavePayload` with:
/// - `saved_content`: The terminal buffer content as a string
/// - `saved_at`: ISO 8601 timestamp when the content was saved
#[capability(id = "terminal.save", target = "terminal")]
fn handle_terminal_save(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for terminal.save")?;

    // Deserialize strongly-typed payload
    let payload: TerminalSavePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for terminal.save: {}", e))?;

    // Update contents JSON object with terminal saved content
    let mut new_contents = if let Some(obj) = block.contents.as_object() {
        obj.clone()
    } else {
        serde_json::Map::new()
    };

    new_contents.insert("saved_content".to_string(), serde_json::json!(payload.saved_content));
    new_contents.insert("saved_at".to_string(), serde_json::json!(payload.saved_at));

    // Create event
    let event = create_event(
        block.block_id.clone(),
        "terminal.save", // cap_id
        serde_json::json!({ "contents": new_contents }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count
    );

    Ok(vec![event])
}
