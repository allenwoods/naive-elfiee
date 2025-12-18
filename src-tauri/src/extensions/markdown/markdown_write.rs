use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use crate::utils::time::now_utc;
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

    // Update metadata.updated_at
    let mut new_metadata = block.metadata.clone();
    if let Some(obj) = new_metadata.as_object_mut() {
        obj.insert("updated_at".to_string(), serde_json::json!(now_utc()));
    } else {
        // If metadata is not an object (e.g. null), initialize it
        new_metadata = serde_json::json!({
            "updated_at": now_utc()
        });
    }

    // Create event
    let event = create_event(
        block.block_id.clone(),
        "markdown.write", // cap_id
        serde_json::json!({
            "contents": new_contents,
            "metadata": new_metadata
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
        Block {
            block_id: "block-123".to_string(),
            name: "Test Block".to_string(),
            block_type: "markdown".to_string(),
            owner: "alice".to_string(),
            contents: serde_json::json!({}),
            children: HashMap::new(),
            metadata: serde_json::json!({
                "created_at": "2025-12-17T02:30:00Z",
                "updated_at": "2025-12-17T02:30:00Z"
            }),
        }
    }

    #[test]
    fn test_markdown_write_updates_timestamp() {
        let block = create_test_block();
        let original_updated = block.metadata["updated_at"].as_str().unwrap();

        // 等待一小段时间确保时间戳不同
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
        let new_metadata = &event.value["metadata"];

        // updated_at 应该被更新
        let new_updated = new_metadata["updated_at"].as_str().unwrap();
        assert_ne!(original_updated, new_updated);

        // created_at 应该保持不变
        assert_eq!(
            new_metadata["created_at"].as_str().unwrap(),
            "2025-12-17T02:30:00Z"
        );

        // 内容应该被更新
        let new_contents = &event.value["contents"];
        assert_eq!(new_contents["markdown"], "# Hello World");
    }

    #[test]
    fn test_markdown_write_preserves_other_metadata() {
        let mut block = create_test_block();
        // 设置自定义字段
        if let Some(obj) = block.metadata.as_object_mut() {
            obj.insert("description".to_string(), serde_json::json!("测试描述"));
            obj.insert(
                "custom_field".to_string(),
                serde_json::json!("custom_value"),
            );
        }

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
        let new_metadata = &events[0].value["metadata"];

        // 其他字段应该保留
        assert_eq!(new_metadata["description"], "测试描述");
        assert_eq!(new_metadata["custom_field"], "custom_value");
        assert_eq!(new_metadata["created_at"], "2025-12-17T02:30:00Z");

        // updated_at 应该被更新
        assert_ne!(new_metadata["updated_at"], "2025-12-17T02:30:00Z");
    }

    #[test]
    fn test_markdown_write_handles_missing_metadata() {
        let mut block = create_test_block();
        block.metadata = serde_json::json!({}); // 空 metadata

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
        let new_metadata = &events[0].value["metadata"];

        // 应该添加 updated_at
        assert!(new_metadata["updated_at"].is_string());
    }
}
