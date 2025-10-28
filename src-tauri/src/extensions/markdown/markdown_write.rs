use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

use super::MarkdownWritePayload;

/// Handler for markdown.write capability.
///
/// Writes markdown content to a markdown block's contents field.
/// The content is stored under the "markdown" key in the contents HashMap.
///
/// # Payload
/// Uses `MarkdownWritePayload` with a single `content` field containing the markdown string.
#[capability(id = "markdown.write", target = "markdown")]
fn handle_markdown_write(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for markdown.write")?;

    // Deserialize strongly-typed payload
    let payload: MarkdownWritePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for markdown.write: {}", e))?;

    // Update contents JSON object with markdown content
    let mut new_contents = if let Some(obj) = block.contents.as_object() {
        obj.clone()
    } else {
        serde_json::Map::new()
    };
    new_contents.insert("markdown".to_string(), serde_json::json!(payload.content));

    // Create event
    let event = create_event(
        block.block_id.clone(),
        "markdown.write", // cap_id
        serde_json::json!({ "contents": new_contents }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count (actor.rs:227)
    );

    Ok(vec![event])
}
