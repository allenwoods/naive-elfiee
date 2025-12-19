use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, BlockMetadata, Command, CreateBlockPayload, Event};
use capability_macros::capability;

/// Handler for core.create capability.
///
/// Creates a new block with name, type, owner, and optional metadata.
/// Automatically generates created_at and updated_at timestamps.
///
/// Note: The block parameter is None for create since the block doesn't exist yet.
#[capability(id = "core.create", target = "core/*")]
fn handle_create(cmd: &Command, _block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Strongly-typed deserialization
    let payload: CreateBlockPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for core.create: {}", e))?;

    // Generate new block ID
    let block_id = uuid::Uuid::new_v4().to_string();

    // Start with auto-generated timestamps
    let mut metadata = BlockMetadata::new();

    // Merge user-provided metadata if present
    if let Some(user_metadata) = payload.metadata {
        if let Ok(parsed) = BlockMetadata::from_json(&user_metadata) {
            // Preserve user's custom fields and description
            metadata.description = parsed.description;
            metadata.custom = parsed.custom;
            // Timestamps are always auto-generated, don't use user-provided ones
        }
    }

    // Create a single event with full initial state
    // Per README.md Part 2: create events contain the full initial state
    let event = create_event(
        block_id.clone(),
        "core.create", // cap_id
        serde_json::json!({
            "name": payload.name,
            "type": payload.block_type,
            "owner": cmd.editor_id,
            "contents": {},
            "children": {},
            "metadata": metadata.to_json()
        }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count (actor.rs:227)
    );

    Ok(vec![event])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Command;

    #[test]
    fn test_create_generates_metadata_with_timestamps() {
        let cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Test Block",
                "block_type": "markdown"
            }),
        );

        let result = handle_create(&cmd, None);
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 1);

        let event = &events[0];
        let metadata = &event.value["metadata"];

        // Should auto-generate timestamps
        assert!(metadata["created_at"].is_string());
        assert!(metadata["updated_at"].is_string());

        // Timestamps should be in UTC format (ending with Z)
        let created = metadata["created_at"].as_str().unwrap();
        let updated = metadata["updated_at"].as_str().unwrap();
        assert!(created.ends_with('Z'));
        assert!(updated.ends_with('Z'));
    }

    #[test]
    fn test_create_merges_user_metadata() {
        let cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Test Block",
                "block_type": "markdown",
                "metadata": {
                    "description": "测试描述"
                }
            }),
        );

        let result = handle_create(&cmd, None);
        assert!(result.is_ok());

        let events = result.unwrap();
        let event = &events[0];
        let metadata = &event.value["metadata"];

        // User-provided fields should be preserved
        assert_eq!(metadata["description"], "测试描述");

        // Auto-generated timestamps should also exist
        assert!(metadata["created_at"].is_string());
        assert!(metadata["updated_at"].is_string());
    }

    #[test]
    fn test_create_without_metadata() {
        let cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Test Block",
                "block_type": "markdown"
            }),
        );

        let result = handle_create(&cmd, None);
        assert!(result.is_ok());

        let events = result.unwrap();
        let event = &events[0];
        let metadata = &event.value["metadata"];

        // Should have timestamps even if user didn't provide metadata
        assert!(metadata.is_object());
        assert!(metadata["created_at"].is_string());
        assert!(metadata["updated_at"].is_string());
    }
}
