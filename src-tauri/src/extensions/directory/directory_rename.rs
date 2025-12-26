/// Capability: rename
///
/// Renames or moves a file/directory, syncs Block.name for files.
use super::DirectoryRenamePayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use crate::utils::infer_block_type;
use capability_macros::capability;
use serde_json::json;

/// Handler for directory.rename capability.
///
/// Renames or moves files/directories in the virtual file system.
/// For files: updates Block.name and entry path.
/// For directories: recursively updates all child paths and file names.
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The Directory Block to operate on
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events to be committed (core.rename for files + directory.write)
/// * `Err(String)` - Error description
///
#[capability(id = "directory.rename", target = "directory")]
fn handle_rename(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Validate block exists and is directory type
    let block = block.ok_or("Block required for directory.rename")?;

    if block.block_type != "directory" {
        return Err(format!(
            "Expected block_type 'directory', got '{}'",
            block.block_type
        ));
    }

    // Step 2: Deserialize payload
    let payload: DirectoryRenamePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for directory.rename: {}", e))?;

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

    // Step 4: Validate old_path exists
    if !entries.contains_key(&payload.old_path) {
        return Err(format!("Old path not found: {}", payload.old_path));
    }

    // Step 5: Validate new_path doesn't exist
    if entries.contains_key(&payload.new_path) {
        return Err(format!("New path already exists: {}", payload.new_path));
    }

    let entry = &entries[&payload.old_path];
    let mut events = Vec::new();

    // Step 6: Handle rename based on entry type
    if entry["type"] == "file" {
        // Rename single file: update Block.name
        let file_id = entry["id"].as_str().ok_or("Missing block ID in entry")?;
        let new_filename = payload
            .new_path
            .split('/')
            .last()
            .unwrap_or(&payload.new_path);

        // Event 1: core.rename to update Block.name
        events.push(create_event(
            file_id.to_string(),
            "core.rename",
            json!({ "name": new_filename }),
            &cmd.editor_id,
            1,
        ));

        // Event 1.5: core.change_type if extension changes
        let old_ext = payload.old_path.split('.').last().unwrap_or("");
        let new_ext = payload.new_path.split('.').last().unwrap_or("");
        if old_ext != new_ext {
            if let Some(new_type) = infer_block_type(new_ext) {
                events.push(create_event(
                    file_id.to_string(),
                    "core.change_type",
                    json!({ "block_type": new_type }),
                    &cmd.editor_id,
                    1,
                ));
            }
        }
    } else if entry["type"] == "directory" {
        // Rename directory: recursively update all children
        let children: Vec<_> = entries
            .iter()
            .filter(|(path, _)| {
                *path == &payload.old_path || path.starts_with(&format!("{}/", payload.old_path))
            })
            .collect();

        for (child_path, child_entry) in children {
            if child_entry["type"] == "file" {
                // Update each child file's Block.name
                let new_child_path = child_path.replace(&payload.old_path, &payload.new_path);
                let new_filename = new_child_path.split('/').last().unwrap_or("");

                let file_id = child_entry["id"]
                    .as_str()
                    .ok_or("Missing block ID in child entry")?;

                events.push(create_event(
                    file_id.to_string(),
                    "core.rename",
                    json!({ "name": new_filename }),
                    &cmd.editor_id,
                    1,
                ));

                // Check for extension change in child
                let old_ext = child_path.split('.').last().unwrap_or("");
                let new_ext = new_child_path.split('.').last().unwrap_or("");
                if old_ext != new_ext {
                    if let Some(new_type) = infer_block_type(new_ext) {
                        events.push(create_event(
                            file_id.to_string(),
                            "core.change_type",
                            json!({ "block_type": new_type }),
                            &cmd.editor_id,
                            1,
                        ));
                    }
                }
            }
            // NOTE: "directory" entries are virtual structural markers and don't
            // have corresponding Block entities to rename. Their paths are
            // updated in the entries map in Step 7.
        }
    }

    // Step 7: Update Directory entries (rename paths)
    let mut new_entries = serde_json::Map::new();

    for (path, entry_value) in entries {
        if path == &payload.old_path || path.starts_with(&format!("{}/", payload.old_path)) {
            // Rename this path
            let new_path = if path == &payload.old_path {
                payload.new_path.clone()
            } else {
                path.replace(&payload.old_path, &payload.new_path)
            };
            new_entries.insert(new_path, entry_value.clone());
        } else {
            // Keep unchanged
            new_entries.insert(path.clone(), entry_value.clone());
        }
    }

    // Step 8: Generate directory.write event
    events.push(create_event(
        block.block_id.clone(),
        "directory.write",
        json!({ "contents": { "entries": new_entries } }),
        &cmd.editor_id,
        1,
    ));

    Ok(events)
}
