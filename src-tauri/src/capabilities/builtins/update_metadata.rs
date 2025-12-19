use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event, UpdateMetadataPayload};
use capability_macros::capability;

/// Handler for core.update_metadata capability.
///
/// Updates the metadata of a block by merging new metadata with existing metadata.
/// This allows partial updates without replacing the entire metadata object.
#[capability(id = "core.update_metadata", target = "core/*")]
fn handle_update_metadata(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for core.update_metadata")?;

    // Strongly-typed deserialization
    let payload: UpdateMetadataPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for core.update_metadata: {}", e))?;

    // Convert BlockMetadata to JSON for merging
    let mut current_json = block.metadata.to_json();

    // Merge new metadata with existing metadata
    if let Some(current_obj) = current_json.as_object_mut() {
        if let Some(new_obj) = payload.metadata.as_object() {
            for (key, value) in new_obj {
                current_obj.insert(key.clone(), value.clone());
            }
        }
    }

    // Add updated_at timestamp
    if let Some(obj) = current_json.as_object_mut() {
        obj.insert(
            "updated_at".to_string(),
            serde_json::json!(chrono::Utc::now().to_rfc3339()),
        );
    }

    // Create event with updated metadata
    let event = create_event(
        block.block_id.clone(),
        "core.update_metadata",
        serde_json::json!({ "metadata": current_json }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count
    );

    Ok(vec![event])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Block, BlockMetadata};

    #[test]
    fn test_update_metadata_adds_new_fields() {
        let block = Block::new(
            "Test".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "core.update_metadata".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "metadata": {
                    "description": "New description"
                }
            }),
        );

        let events = handle_update_metadata(&cmd, Some(&block)).unwrap();
        assert_eq!(events.len(), 1);

        let metadata = events[0].value.get("metadata").unwrap();
        assert_eq!(metadata["description"], "New description");
        assert!(metadata.get("updated_at").is_some());
    }

    #[test]
    fn test_update_metadata_merges_with_existing() {
        let mut block = Block::new(
            "Test".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );
        block.metadata = BlockMetadata::from_json(&serde_json::json!({
            "description": "Original description",
            "tags": ["tag1"]
        }))
        .unwrap();

        let cmd = Command::new(
            "alice".to_string(),
            "core.update_metadata".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "metadata": {
                    "description": "Updated description",
                    "author": "Alice"
                }
            }),
        );

        let events = handle_update_metadata(&cmd, Some(&block)).unwrap();
        assert_eq!(events.len(), 1);

        let metadata = events[0].value.get("metadata").unwrap();
        assert_eq!(metadata["description"], "Updated description"); // Updated
        assert_eq!(metadata["tags"], serde_json::json!(["tag1"])); // Preserved
        assert_eq!(metadata["author"], "Alice"); // Added
        assert!(metadata.get("updated_at").is_some()); // Auto-added
    }

    #[test]
    fn test_update_metadata_requires_block() {
        let cmd = Command::new(
            "alice".to_string(),
            "core.update_metadata".to_string(),
            "block-123".to_string(),
            serde_json::json!({
                "metadata": {
                    "description": "Test"
                }
            }),
        );

        let result = handle_update_metadata(&cmd, None);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            "Block required for core.update_metadata"
        );
    }
}
