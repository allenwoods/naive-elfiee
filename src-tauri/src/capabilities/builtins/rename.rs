use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event, RenamePayload};
use capability_macros::capability;
use serde_json::json;

/// Handler for core.rename capability.
///
/// Updates the name field of a block.
/// Also updates the updated_at timestamp.
#[capability(id = "core.rename", target = "core/*")]
fn handle_rename(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for core.rename")?;

    let payload: RenamePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for core.rename: {}", e))?;

    let name = payload.name.trim();

    // Validate name is not empty
    if name.is_empty() {
        return Err("Block name cannot be empty".to_string());
    }

    // Update timestamp
    let mut new_metadata = block.metadata.clone();
    new_metadata.touch();

    let event = create_event(
        block.block_id.clone(),
        "core.rename",
        json!({
            "name": name,
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
    fn test_rename_block() {
        let block = Block::new(
            "Old Name".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "core.rename".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "name": "New Name" }),
        );

        let events = handle_rename(&cmd, Some(&block)).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].value["name"], "New Name");
    }

    #[test]
    fn test_rename_empty_name_fails() {
        let block = Block::new(
            "Old Name".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "core.rename".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "name": "" }),
        );

        let result = handle_rename(&cmd, Some(&block));
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Block name cannot be empty");
    }

    #[test]
    fn test_rename_requires_block() {
        let cmd = Command::new(
            "alice".to_string(),
            "core.rename".to_string(),
            "block-123".to_string(),
            serde_json::json!({ "name": "New Name" }),
        );

        let result = handle_rename(&cmd, None);
        assert!(result.is_err());
    }
}
