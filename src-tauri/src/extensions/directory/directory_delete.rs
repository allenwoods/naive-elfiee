/// Capability: delete
///
/// Deletes a file or directory entry from the Directory Block (reference semantics).
use super::DirectoryDeletePayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use serde_json::json;

/// Handler for directory.delete capability.
///
/// Deletes entries from the virtual file system using **pure reference semantics**.
///
/// # Reference Semantics (Unix inode-like)
/// - Directory.entries are **references**, not containers
/// - Deleting an entry only removes the reference from the directory index
/// - The underlying Block is **NOT deleted** - it continues to exist independently
/// - Block lifecycle is managed by ownership (editor) and eventual GC (based on reachability)
///
/// # Examples
/// - If Block B is referenced by both Directory A and Directory C:
///   - `directory.delete` on A removes A's reference to B
///   - Block B remains accessible via Directory C
///   - Block B owner can still access it directly
/// - If user wants to delete the Block itself, they must use `core.delete` on the Block
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The Directory Block to operate on
///
/// # Returns
/// * `Ok(Vec<Event>)` - Single directory.write event updating the entries map
/// * `Err(String)` - Error description
///
#[capability(id = "directory.delete", target = "directory")]
fn handle_delete(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Validate block exists and is directory type
    let block = block.ok_or("Block required for directory.delete")?;

    if block.block_type != "directory" {
        return Err(format!(
            "Expected block_type 'directory', got '{}'",
            block.block_type
        ));
    }

    // Step 2: Deserialize payload
    let payload: DirectoryDeletePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for directory.delete: {}", e))?;

    // Step 3: Parse current Directory Block contents
    let contents = block
        .contents
        .as_object()
        .ok_or("Invalid directory structure: contents must be an object")?;

    let entries = contents
        .get("entries")
        .and_then(|v| v.as_object())
        .ok_or("Invalid directory structure: entries must be an object")?;

    // Step 4: Check if path exists
    if !entries.contains_key(&payload.path) {
        return Err(format!("Path not found: {}", payload.path));
    }

    // Step 5: Remove entries from Directory index (reference semantics)
    // This removes the specified path and all its children (if it's a directory)
    let mut new_entries = entries.clone();
    let paths_to_remove: Vec<_> = new_entries
        .keys()
        .filter(|k| *k == &payload.path || k.starts_with(&format!("{}/", payload.path)))
        .cloned()
        .collect();

    for path in paths_to_remove {
        new_entries.remove(&path);
    }

    // Step 6: Generate directory.write event to update entries
    // NOTE: No core.delete events are generated - Block lifecycle is independent
    let event = create_event(
        block.block_id.clone(),
        "directory.write",
        json!({ "contents": { "entries": new_entries } }),
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
