/// Capability: watch
///
/// Enables or disables file system watching (flag only, no actual watching implemented).
use super::DirectoryWatchPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for watch capability.
///
/// Sets the watch_enabled flag in Block.contents.
/// Actual file system watching is not implemented in this version.
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The block representing the directory
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events with updated watch flag
/// * `Err(String)` - Error description
///
#[capability(id = "directory.watch", target = "directory")]
fn handle_watch(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Deserialize payload
    let payload: DirectoryWatchPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|err| format!("Invalid payload for directory.watch: {}", err))?;

    // Step 2: Validate block exists
    let block = block.ok_or("Block required for directory.watch capability")?;

    // Step 3: Create event to update watch_enabled flag
    let value = serde_json::json!({
        "watch_enabled": payload.enabled,
        "updated_at": chrono::Utc::now().to_rfc3339(),
    });

    let event = create_event(
        block.block_id.clone(),
        "directory.watch",
        value,
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
