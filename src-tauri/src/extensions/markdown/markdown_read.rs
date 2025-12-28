use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for markdown.read capability.
///
/// Reads markdown content from a markdown block's contents field.
///
/// # READ FLOW CLARIFICATION
/// In Elfiee's command-event architecture:
/// 1. Data Retrieval: The frontend uses the `get_block` or `get_all_blocks` query commands
///    to fetch block contents. These queries bypass the Capability Handler layer.
/// 2. Permission Gate: The `markdown.read` capability exists primarily as a permission marker
///    for future row-level authorization logic in the query layer (CBAC).
/// 3. Audit Trail: Unlike `code.read`, this handler generates an event to audit/record that
///    a specific user accessed specific content, though the data is usually fetched via query.
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
        1, // Placeholder - engine actor updates with correct count (actor.rs:227)
    );

    Ok(vec![event])
}
