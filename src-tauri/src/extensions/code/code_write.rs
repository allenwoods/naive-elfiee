use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use serde_json::json;

use super::CodeWritePayload;

/// Handler for code.write capability.
///
/// Writes text content to a code block's contents field.
/// The content is stored under the "text" key in the contents object.
/// Automatically updates the block's metadata.updated_at timestamp.
#[capability(id = "code.write", target = "code")]
fn handle_code_write(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for code.write")?;

    // Deserialize strongly-typed payload
    let payload: CodeWritePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for code.write: {}", e))?;

    // Update contents JSON object with text content
    let mut new_contents = if let Some(obj) = block.contents.as_object() {
        obj.clone()
    } else {
        serde_json::Map::new()
    };
    new_contents.insert("text".to_string(), json!(payload.content));

    // Update metadata timestamp
    let mut new_metadata = block.metadata.clone();
    new_metadata.touch();

    // Create event (NOTE: count=1 is a placeholder, engine will update it)
    let event = create_event(
        block.block_id.clone(),
        "code.write",
        json!({
            "contents": new_contents,
            "metadata": new_metadata.to_json()
        }),
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
