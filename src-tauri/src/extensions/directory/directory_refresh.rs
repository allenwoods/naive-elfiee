/// Capability: refresh
///
/// Re-scans external directory and synchronizes with internal state (Mirror Sync).
use super::DirectoryRefreshPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use crate::utils::time::now_utc;
use crate::utils::{infer_block_type, is_safe_path, scan_directory, ScanOptions};
use capability_macros::capability;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

/// Handler for directory.refresh capability.
///
/// Implements a 3-way diff algorithm to detect changes:
/// 1. **Additions**: Files in external directory but not in internal entries
/// 2. **Modifications**: Files in both, but content/metadata changed
/// 3. **Deletions**: Files in internal entries but not in external directory
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The Directory Block to refresh
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events for additions, modifications, and deletions
/// * `Err(String)` - Error description
///
#[capability(id = "directory.refresh", target = "directory")]
fn handle_refresh(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Validate block exists
    let block = block.ok_or("Block required for directory.refresh")?;

    if block.block_type != "directory" {
        return Err(format!(
            "Expected block_type 'directory', got '{}'",
            block.block_type
        ));
    }

    // Step 2: Deserialize payload
    let payload: DirectoryRefreshPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for directory.refresh: {}", e))?;

    // Step 3: Get external_root_path
    let external_root = payload
        .source_path
        .or_else(|| {
            block
                .metadata
                .custom
                .get("external_root_path")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .ok_or("No external_root_path found. Use payload.source_path or ensure Block.metadata.custom.external_root_path is set.")?;

    // Step 4: Validate and scan external directory
    let source = Path::new(&external_root);
    is_safe_path(source)?;

    if !source.exists() {
        return Err(format!("External path does not exist: {}", external_root));
    }

    if !source.is_dir() {
        return Err(format!(
            "External path is not a directory: {}",
            external_root
        ));
    }

    let options = ScanOptions::default();
    let current_files =
        scan_directory(source, &options).map_err(|e| format!("Failed to scan directory: {}", e))?;

    // Step 5: Parse existing entries
    let old_entries = block
        .contents
        .get("entries")
        .and_then(|v| v.as_object())
        .ok_or("Invalid directory structure: missing entries")?;

    // Step 6: Build current external file map (relative_path -> FileInfo)
    let mut current_map: HashMap<String, _> = HashMap::new();
    for file_info in &current_files {
        current_map.insert(file_info.relative_path.clone(), file_info);
    }

    let mut events = Vec::new();
    let mut new_entries = old_entries.clone();

    // Step 7: Detect ADDITIONS and MODIFICATIONS
    for (relative_path, file_info) in &current_map {
        match old_entries.get(relative_path) {
            None => {
                // ADDITION: File exists externally but not internally
                if file_info.is_directory {
                    // Add directory entry
                    let dir_id = format!("dir-{}", uuid::Uuid::new_v4());
                    new_entries.insert(
                        relative_path.clone(),
                        json!({
                            "id": dir_id,
                            "type": "directory",
                            "source": "linked",
                            "updated_at": now_utc()
                        }),
                    );
                } else {
                    // Create new file block
                    let block_type = match infer_block_type(&file_info.extension) {
                        Some(t) => t,
                        None => {
                            log::warn!("Skipping unsupported file: {:?}", file_info.absolute_path);
                            continue;
                        }
                    };

                    let content = fs::read_to_string(&file_info.absolute_path).map_err(|e| {
                        format!("Failed to read file {:?}: {}", file_info.absolute_path, e)
                    })?;

                    let file_block_id = uuid::Uuid::new_v4().to_string();

                    events.push(create_event(
                        file_block_id.clone(),
                        "core.create",
                        json!({
                            "name": file_info.file_name,
                            "type": block_type,
                            "owner": cmd.editor_id,
                            "contents": {
                                "text": content,
                                "language": file_info.extension
                            },
                            "children": {},
                            "metadata": {}
                        }),
                        &cmd.editor_id,
                        1,
                    ));

                    new_entries.insert(
                        relative_path.clone(),
                        json!({
                            "id": file_block_id,
                            "type": "file",
                            "source": "linked",
                            "external_path": file_info.absolute_path.to_string_lossy(),
                            "updated_at": now_utc()
                        }),
                    );
                }
            }
            Some(entry) => {
                // File exists in both - check for MODIFICATIONS
                if entry["type"] == "file" {
                    // Read current external content
                    let new_content =
                        fs::read_to_string(&file_info.absolute_path).map_err(|e| {
                            format!("Failed to read file {:?}: {}", file_info.absolute_path, e)
                        })?;

                    // For modification detection, we'd need to read the current Block content
                    // Since we only have Block metadata here, we update the entry's timestamp
                    // and generate a refresh marker event

                    // Update entry timestamp
                    if let Some(obj) = new_entries
                        .get_mut(relative_path)
                        .and_then(|v| v.as_object_mut())
                    {
                        obj.insert("updated_at".to_string(), json!(now_utc()));
                        obj.insert(
                            "external_path".to_string(),
                            json!(file_info.absolute_path.to_string_lossy()),
                        );
                    }

                    // Generate update event for the content block
                    let file_id = entry["id"].as_str().ok_or("Missing block ID")?;
                    let block_type = infer_block_type(&file_info.extension)
                        .unwrap_or_else(|| "markdown".to_string());

                    events.push(create_event(
                        file_id.to_string(),
                        format!("{}.write", block_type).as_str(),
                        json!({
                            "contents": {
                                "text": new_content,
                                "language": file_info.extension
                            }
                        }),
                        &cmd.editor_id,
                        1,
                    ));
                }
            }
        }
    }

    // Step 8: Detect DELETIONS
    let current_paths: HashSet<_> = current_map.keys().cloned().collect();

    for (old_path, old_entry) in old_entries {
        if !current_paths.contains(old_path) {
            // DELETION: File exists internally but not externally
            if old_entry["type"] == "file" {
                let file_id = old_entry["id"].as_str().ok_or("Missing block ID")?;
                events.push(create_event(
                    file_id.to_string(),
                    "core.delete",
                    json!({}),
                    &cmd.editor_id,
                    1,
                ));
            }

            // Remove from entries (applies to both files and directories)
            new_entries.remove(old_path);
        }
    }

    // Step 9: Update Directory Block entries
    events.push(create_event(
        block.block_id.clone(),
        "directory.write",
        json!({ "contents": { "entries": new_entries } }),
        &cmd.editor_id,
        1,
    ));

    // Step 10: Update metadata timestamp
    events.push(create_event(
        block.block_id.clone(),
        "core.update_metadata",
        json!({
            "metadata": {
                "last_refresh": now_utc()
            }
        }),
        &cmd.editor_id,
        1,
    ));

    Ok(events)
}
