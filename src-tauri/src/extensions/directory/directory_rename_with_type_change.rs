/// Capability: rename_with_type_change
///
/// Atomically renames a file and changes its block type in a single transaction.
/// This ensures consistency when file extension changes require block type updates.
use super::DirectoryRenameWithTypeChangePayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use crate::utils::infer_block_type;
use capability_macros::capability;
use serde_json::json;

/// Handler for directory.rename_with_type_change capability.
///
/// Atomically performs both rename and block type change operations:
/// 1. Renames the file entry in directory structure
/// 2. Updates Block.name for the file
/// 3. Changes Block.block_type if extension changed
///
/// All events are generated in a single transaction, ensuring atomicity.
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The Directory Block to operate on
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events to be committed atomically:
///   - core.rename: Updates Block.name
///   - core.change_type: Updates Block.block_type (if type inference succeeds)
///   - directory.write: Updates directory entries
/// * `Err(String)` - Error description (rollback all changes)
///
#[capability(id = "directory.rename_with_type_change", target = "directory")]
fn handle_rename_with_type_change(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Validate block exists and is directory type
    let block = block.ok_or("Block required for directory.rename_with_type_change")?;

    if block.block_type != "directory" {
        return Err(format!(
            "Expected block_type 'directory', got '{}'",
            block.block_type
        ));
    }

    // Step 2: Deserialize payload
    let payload: DirectoryRenameWithTypeChangePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| {
            format!(
                "Invalid payload for directory.rename_with_type_change: {}",
                e
            )
        })?;

    // Step 3: Validate path security
    crate::utils::validate_virtual_path(&payload.new_path)?;

    // Step 4: Parse current Directory Block contents
    let contents = block
        .contents
        .as_object()
        .ok_or("Invalid directory structure: contents must be an object")?;

    let entries = contents
        .get("entries")
        .and_then(|v| v.as_object())
        .ok_or("Invalid directory structure: entries must be an object")?;

    // Step 5: Validate old_path exists and is a file
    if !entries.contains_key(&payload.old_path) {
        return Err(format!("Old path not found: {}", payload.old_path));
    }

    let entry = &entries[&payload.old_path];
    if entry["type"] != "file" {
        return Err(format!(
            "Only files can use rename_with_type_change. Use directory.rename for directories."
        ));
    }

    // Step 6: Validate new_path doesn't exist
    if entries.contains_key(&payload.new_path) {
        return Err(format!("New path already exists: {}", payload.new_path));
    }

    // Step 7: Get file block ID
    let file_id = entry["id"]
        .as_str()
        .ok_or("Missing block ID in file entry")?;
    let new_filename = payload
        .new_path
        .split('/')
        .last()
        .unwrap_or(&payload.new_path);

    let mut events = Vec::new();

    // Step 8: Event 1 - core.rename to update Block.name
    events.push(create_event(
        file_id.to_string(),
        "core.rename",
        json!({ "name": new_filename }),
        &cmd.editor_id,
        1,
    ));

    // Step 9: Event 2 - core.change_type if type change requested
    let target_type = if let Some(t) = &payload.block_type {
        // Case 1: Direct type specification
        Some(t.clone())
    } else if let Some(ext) = &payload.file_extension {
        // Case 2: Infer from extension
        infer_block_type(ext)
    } else {
        // No type change requested
        None
    };

    if let Some(new_type) = target_type {
        events.push(create_event(
            file_id.to_string(),
            "core.change_type",
            json!({ "block_type": new_type }),
            &cmd.editor_id,
            1,
        ));
    }

    // Step 10: Event 3 - directory.write to update entry paths
    let mut new_entries = serde_json::Map::new();

    for (path, entry_value) in entries {
        if path == &payload.old_path {
            // Rename this path
            new_entries.insert(payload.new_path.clone(), entry_value.clone());
        } else {
            // Keep unchanged
            new_entries.insert(path.clone(), entry_value.clone());
        }
    }

    events.push(create_event(
        block.block_id.clone(),
        "directory.write",
        json!({ "contents": { "entries": new_entries } }),
        &cmd.editor_id,
        1,
    ));

    Ok(events)
}
