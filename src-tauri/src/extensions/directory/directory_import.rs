/// Capability: import
///
/// Imports files from external directory into the Directory Block.
use super::DirectoryImportPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use crate::utils::time::now_utc;
use crate::utils::{infer_block_type, is_safe_path, scan_directory, ScanOptions};
use capability_macros::capability;
use serde_json::json;
use std::fs;
use std::path::Path;

/// Handler for directory.import capability.
///
/// Imports files and directories from external file system into the virtual file system.
/// - Scans external directory with filtering
/// - Infers Block types based on file extensions
/// - Creates Content Blocks for each file
/// - Updates Directory entries
/// - Records external_root_path in metadata
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The Directory Block to operate on
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events to be committed (core.create × N + directory.write + core.update_metadata)
/// * `Err(String)` - Error description
///
#[capability(id = "directory.import", target = "directory")]
fn handle_import(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Validate block exists and is directory type
    let block = block.ok_or("Block required for directory.import")?;

    if block.block_type != "directory" {
        return Err(format!(
            "Expected block_type 'directory', got '{}'",
            block.block_type
        ));
    }

    // Step 2: Deserialize payload
    let payload: DirectoryImportPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for directory.import: {}", e))?;

    // Step 3: Validate source path safety
    let source = Path::new(&payload.source_path);
    is_safe_path(source)?;

    if !source.exists() {
        return Err(format!(
            "Source path does not exist: {}",
            payload.source_path
        ));
    }

    if !source.is_dir() {
        return Err(format!(
            "Source path is not a directory: {}",
            payload.source_path
        ));
    }

    // Step 4: Scan external directory
    let options = ScanOptions::default();
    let files =
        scan_directory(source, &options).map_err(|e| format!("Failed to scan directory: {}", e))?;

    // Step 5: Parse current Directory Block contents
    let mut contents: serde_json::Map<String, serde_json::Value> =
        block.contents.as_object().cloned().unwrap_or_default();

    // Initialize entries if not exists
    if !contents.contains_key("entries") {
        contents.insert("entries".to_string(), json!({}));
    }

    let entries = contents
        .get_mut("entries")
        .and_then(|v| v.as_object_mut())
        .ok_or("Invalid directory structure: entries must be an object")?;

    let target_prefix = payload
        .target_path
        .unwrap_or_else(|| "/".to_string())
        .trim_end_matches('/')
        .to_string();

    let mut events = Vec::new();

    // Step 6: Process each file
    for file_info in files {
        if file_info.is_directory {
            // Add directory entry (virtual, no Block)
            let virtual_path = if target_prefix == "/" || target_prefix.is_empty() {
                file_info.relative_path.clone()
            } else {
                format!("{}/{}", target_prefix, file_info.relative_path)
            };

            let dir_id = format!("dir-{}", uuid::Uuid::new_v4());

            entries.insert(
                virtual_path,
                json!({
                    "id": dir_id,
                    "type": "directory",
                    "source": "linked",
                    "updated_at": now_utc()
                }),
            );
        } else {
            // Infer block type
            let block_type = match infer_block_type(&file_info.extension) {
                Some(t) => t,
                None => {
                    log::warn!("Skipping unsupported file: {:?}", file_info.absolute_path);
                    continue;
                }
            };

            // Read file content
            let content = fs::read_to_string(&file_info.absolute_path)
                .map_err(|e| format!("Failed to read file {:?}: {}", file_info.absolute_path, e))?;

            // Create Content Block
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

            // Add entry to Directory
            let virtual_path = if target_prefix == "/" || target_prefix.is_empty() {
                file_info.relative_path.clone()
            } else {
                format!("{}/{}", target_prefix, file_info.relative_path)
            };

            entries.insert(
                virtual_path,
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

    // Step 7: Update Directory Block contents
    events.push(create_event(
        block.block_id.clone(),
        "directory.write",
        json!({ "contents": { "entries": entries } }),
        &cmd.editor_id,
        1,
    ));

    // Step 8: Update Directory Block metadata (record external root path)
    events.push(create_event(
        block.block_id.clone(),
        "core.update_metadata",
        json!({
            "metadata": {
                "is_repo": true,
                "external_root_path": payload.source_path,
                "last_import": now_utc()
            }
        }),
        &cmd.editor_id,
        1,
    ));

    Ok(events)
}
