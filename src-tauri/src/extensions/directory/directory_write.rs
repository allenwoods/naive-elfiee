use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use serde::{Deserialize, Serialize};
use specta::Type;

/// Payload for directory.write capability.
///
/// Used to directly update the entries map of a directory block.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DirectoryWritePayload {
    /// The full entries map to be saved
    pub entries: serde_json::Value,
}

/// Handler for directory.write capability.
///
/// This capability formally defines the logic for updating a directory's index.
/// While often called by other handlers (like import), it can also be called directly.
#[capability(id = "directory.write", target = "directory")]
fn handle_write(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for directory.write")?;

    let payload: DirectoryWritePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for directory.write: {}", e))?;

    if !payload.entries.is_object() {
        return Err("Entries must be a JSON object".to_string());
    }

    let event = create_event(
        block.block_id.clone(),
        "directory.write",
        serde_json::json!({
            "contents": {
                "entries": payload.entries
            }
        }),
        &cmd.editor_id,
        1, // Placeholder, updated by actor
    );

    Ok(vec![event])
}
