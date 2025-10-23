use crate::capabilities::core::{CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for markdown.write capability.
///
/// Writes markdown content to a markdown block's contents field.
/// The content is stored under the "markdown" key in the contents HashMap.
#[capability(id = "markdown.write", target = "markdown")]
fn handle_markdown_write(cmd: &Command, block: &Block) -> CapResult<Vec<Event>> {
    // Extract markdown content from payload
    let markdown_content = cmd.payload.get("content")
        .and_then(|v| v.as_str())
        .ok_or("Missing 'content' in payload")?;

    // Update contents JSON object with markdown content
    let mut new_contents = if let Some(obj) = block.contents.as_object() {
        obj.clone()
    } else {
        serde_json::Map::new()
    };
    new_contents.insert("markdown".to_string(), serde_json::json!(markdown_content));

    // Create event
    let event = create_event(
        block.block_id.clone(),
        "markdown.write",  // cap_id
        serde_json::json!({ "contents": new_contents }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
