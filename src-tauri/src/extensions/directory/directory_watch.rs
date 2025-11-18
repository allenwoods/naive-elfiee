/// Capability: watch
///
/// Enables or disables directory watching
///
/// **Current Implementation**: This capability only sets a `watch_enabled` flag in the block's
/// contents. It does NOT implement actual filesystem monitoring yet.
///
/// **Future Plan**: When `watch_enabled` is true, the system will:
/// 1. Use the `notify` crate to monitor filesystem events for the directory
/// 2. Emit events when files are created, modified, or deleted
/// 3. Automatically trigger `directory.refresh` when changes are detected
/// 4. Notify connected clients via Tauri events for real-time updates
///
/// **Current Behavior**:
/// - Setting `watch_enabled: true` stores the flag in `block.contents`
/// - No actual filesystem watching occurs
/// - Clients must manually call `directory.refresh` to update the listing
///
/// **Integration Requirements** (for future implementation):
/// - Add `notify` crate dependency
/// - Create a watcher manager in the Engine
/// - Map file events to Elfiee events
/// - Handle watcher lifecycle (start/stop on open/close)
///
use super::DirectoryWatchPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// Handler for watch capability.
///
/// Sets the `watch_enabled` flag in block contents. This is currently a **stub implementation**
/// that only stores the flag without implementing actual filesystem monitoring.
///
/// # Arguments
/// * `cmd` - The command containing the payload with `enabled` field
/// * `block` - The block representing the directory (must exist)
///
/// # Payload
/// ```json
/// {
///   "enabled": true  // or false to disable
/// }
/// ```
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events with updated `watch_enabled` status
/// * `Err(String)` - Error description if payload is invalid or block is missing
///
/// # Example
/// ```rust,ignore
/// let payload = DirectoryWatchPayload { enabled: true };
/// let events = handle_watch(&command, Some(&block))?;
/// // block.contents will now include: { "watch_enabled": true, "updated_at": "..." }
/// ```
///
/// # Note
/// This is a placeholder for future filesystem watching functionality. Applications using this
/// capability should be aware that:
/// - No automatic updates will occur when files change
/// - The `watch_enabled` flag is purely informational
/// - Use `directory.refresh` to manually update directory listings
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
