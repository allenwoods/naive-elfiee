/// Capability: delete
///
/// Deletes a file or directory from the Directory Block (cascade delete).
use super::DirectoryDeletePayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use serde_json::json;

/// Handler for directory.delete capability.
///
/// Deletes a file or directory from the virtual file system.
/// For files: deletes the Content Block and removes entry.
/// For directories: recursively deletes all child blocks and entries (cascade).
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The Directory Block to operate on
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events to be committed (core.delete for blocks + directory.write)
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
    let entry = entries
        .get(&payload.path)
        .ok_or(format!("Path not found: {}", payload.path))?;

    let mut events = Vec::new();

    // Step 5: Handle deletion based on entry type
    if entry["type"] == "directory" {
        // Recursively delete all children
        let children: Vec<_> = entries
            .iter()
            .filter(|(path, _)| path.starts_with(&payload.path))
            .collect();

        for (_, child_entry) in children {
            if child_entry["type"] == "file" {
                // Delete child Content Block
                let child_id = child_entry["id"]
                    .as_str()
                    .ok_or("Missing block ID in entry")?;

                events.push(create_event(
                    child_id.to_string(),
                    "core.delete",
                    json!({}),
                    &cmd.editor_id,
                    1,
                ));
            }
        }
    } else if entry["type"] == "file" {
        // Delete single file's Content Block
        let file_id = entry["id"].as_str().ok_or("Missing block ID in entry")?;

        events.push(create_event(
            file_id.to_string(),
            "core.delete",
            json!({}),
            &cmd.editor_id,
            1,
        ));
    }

    // Step 6: Update Directory entries (remove deleted paths)
    let mut new_entries = entries.clone();
    let paths_to_remove: Vec<_> = new_entries
        .keys()
        .filter(|k| k.starts_with(&payload.path) || *k == &payload.path)
        .cloned()
        .collect();

    for path in paths_to_remove {
        new_entries.remove(&path);
    }

    // Step 7: Generate directory.write event
    events.push(create_event(
        block.block_id.clone(),
        "directory.write",
        json!({ "contents": { "entries": new_entries } }),
        &cmd.editor_id,
        1,
    ));

    Ok(events)
}
