use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for markdown.read capability.
///
/// Reads markdown content from a markdown block's contents field.
/// Returns the current markdown content as an event for the reader to observe.
/// This is a read operation that creates an event recording the read action.
#[capability(id = "markdown.read", target = "markdown")]
fn handle_markdown_read(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for markdown.read")?;
    // Extract markdown content from block
    let markdown_content = block
        .contents
        .get("markdown")
        .ok_or("No markdown content found in block")?;

    // Create read event
    // Note: This is a read operation, so we create an event that records the read
    // but doesn't mutate the block state. The entity is the reader's editor_id.
    let event = create_event(
        cmd.editor_id.clone(), // Entity is the reader
        "markdown.read",       // cap_id
        serde_json::json!({
            "block_id": block.block_id,
            "content": markdown_content
        }),
        &cmd.editor_id,
        1, // TODO: Replace with actual vector clock count
    );

    Ok(vec![event])
}
