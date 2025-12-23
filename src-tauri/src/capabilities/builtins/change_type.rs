use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, ChangeTypePayload, Command, Event};
use capability_macros::capability;
use serde_json::json;

/// Handler for core.change_type capability.
///
/// Changes the block_type field of a block.
/// Also updates the updated_at timestamp.
/// WARNING: This does not validate that the new type is compatible with existing contents.
#[capability(id = "core.change_type", target = "core/*")]
fn handle_change_type(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for core.change_type")?;

    let payload: ChangeTypePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for core.change_type: {}", e))?;

    let block_type = payload.block_type.trim();

    // Validate block_type is not empty
    if block_type.is_empty() {
        return Err("Block type cannot be empty".to_string());
    }

    // Update timestamp
    let mut new_metadata = block.metadata.clone();
    new_metadata.touch();

    let event = create_event(
        block.block_id.clone(),
        "core.change_type",
        json!({
            "block_type": block_type,
            "metadata": new_metadata.to_json()
        }),
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Block;

    #[test]
    fn test_change_type() {
        let block = Block::new(
            "Test".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "core.change_type".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "block_type": "code" }),
        );

        let events = handle_change_type(&cmd, Some(&block)).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].value["block_type"], "code");
    }

    #[test]
    fn test_change_type_empty_fails() {
        let block = Block::new(
            "Test".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "core.change_type".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "block_type": "" }),
        );

        let result = handle_change_type(&cmd, Some(&block));
        assert!(result.is_err());
    }

    #[test]
    fn test_change_type_requires_block() {
        let cmd = Command::new(
            "alice".to_string(),
            "core.change_type".to_string(),
            "block-123".to_string(),
            serde_json::json!({ "block_type": "code" }),
        );

        let result = handle_change_type(&cmd, None);
        assert!(result.is_err());
    }
}
