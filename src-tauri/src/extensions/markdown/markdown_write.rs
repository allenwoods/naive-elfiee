use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

use super::MarkdownWritePayload;

/// Handler for markdown.write capability.
///
/// Writes markdown content to a markdown block's contents field.
/// The content is stored under the "markdown" key in the contents HashMap.
/// Automatically updates the block's metadata.updated_at timestamp.
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

    // Update metadata.updated_at using the touch() method
    let mut new_metadata = block.metadata.clone();
    new_metadata.touch();

    // Create event
    let event = create_event(
        block.block_id.clone(),
        "markdown.write", // cap_id
        serde_json::json!({
            "contents": new_contents,
            "metadata": new_metadata.to_json()
        }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count (actor.rs:227)
    );

    Ok(vec![event])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Block, Command};
    use std::collections::HashMap;

    fn create_test_block() -> Block {
        use crate::models::BlockMetadata;

        Block {
            block_id: "block-123".to_string(),
            name: "Test Block".to_string(),
            block_type: "markdown".to_string(),
            owner: "alice".to_string(),
            contents: serde_json::json!({}),
            children: HashMap::new(),
            metadata: BlockMetadata {
                description: None,
                created_at: Some("2025-12-17T02:30:00Z".to_string()),
                updated_at: Some("2025-12-17T02:30:00Z".to_string()),
                custom: HashMap::new(),
            },
        }
    }

    #[test]
    fn test_markdown_write_updates_timestamp() {
        use crate::models::BlockMetadata;

        let block = create_test_block();
        let original_updated = block.metadata.updated_at.clone().unwrap();

        // Wait a moment to ensure timestamp is different
        std::thread::sleep(std::time::Duration::from_millis(10));

        let cmd = Command::new(
            "alice".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "content": "# Hello World"
            }),
        );

        let result = handle_markdown_write(&cmd, Some(&block));
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 1);

        let event = &events[0];
        let new_metadata_json = &event.value["metadata"];
        let new_metadata = BlockMetadata::from_json(new_metadata_json).unwrap();

        // updated_at should be updated
        let new_updated = new_metadata.updated_at.clone().unwrap();
        assert_ne!(original_updated, new_updated);

        // created_at should remain unchanged
        assert_eq!(new_metadata.created_at.unwrap(), "2025-12-17T02:30:00Z");

        // Content should be updated
        let new_contents = &event.value["contents"];
        assert_eq!(new_contents["markdown"], "# Hello World");
    }

    #[test]
    fn test_markdown_write_preserves_other_metadata() {
        use crate::models::BlockMetadata;

        let mut block = create_test_block();
        // Set custom fields
        block.metadata.description = Some("测试描述".to_string());
        block.metadata.custom.insert(
            "custom_field".to_string(),
            serde_json::json!("custom_value"),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "content": "New content"
            }),
        );

        let result = handle_markdown_write(&cmd, Some(&block));
        assert!(result.is_ok());

        let events = result.unwrap();
        let new_metadata_json = &events[0].value["metadata"];
        let new_metadata = BlockMetadata::from_json(new_metadata_json).unwrap();

        // Other fields should be preserved
        assert_eq!(new_metadata.description, Some("测试描述".to_string()));
        assert_eq!(
            new_metadata.custom.get("custom_field").unwrap(),
            "custom_value"
        );
        assert_eq!(
            new_metadata.created_at,
            Some("2025-12-17T02:30:00Z".to_string())
        );

        // updated_at should be updated
        assert_ne!(
            new_metadata.updated_at,
            Some("2025-12-17T02:30:00Z".to_string())
        );
    }

    #[test]
    fn test_markdown_write_handles_missing_metadata() {
        use crate::models::BlockMetadata;

        let mut block = create_test_block();
        block.metadata = BlockMetadata::default(); // Empty metadata

        let cmd = Command::new(
            "alice".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "content": "Content"
            }),
        );

        let result = handle_markdown_write(&cmd, Some(&block));
        assert!(result.is_ok());

        let events = result.unwrap();
        let new_metadata_json = &events[0].value["metadata"];
        let new_metadata = BlockMetadata::from_json(new_metadata_json).unwrap();

        // Should add updated_at
        assert!(new_metadata.updated_at.is_some());
    }

    // Note: test_markdown_write_handles_null_metadata_with_created_at removed
    // because Block.metadata is now strongly typed as BlockMetadata and cannot be null
}
