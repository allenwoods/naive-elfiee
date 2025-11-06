/// Capability: delete
///
/// Deletes a file or directory.
use super::DirectoryDeletePayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::fs;
use std::path::Path;

/// Handler for delete capability.
///
/// Deletes a file or directory from the filesystem.
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The block representing the directory
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events indicating deletion
/// * `Err(String)` - Error description
///
#[capability(id = "directory.delete", target = "directory")]
fn handle_delete(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Deserialize payload
    let payload: DirectoryDeletePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|err| format!("Invalid payload for directory.delete: {}", err))?;

    // Step 2: Validate block exists
    let block = block.ok_or("Block required for directory.delete capability")?;

    // Step 3: Validate payload
    if payload.path.trim().is_empty() {
        return Err("DirectoryDeletePayload.path must not be empty".into());
    }

    // Step 4: Get root from block contents
    let root = block
        .contents
        .get("root")
        .and_then(|v| v.as_str())
        .ok_or("Block.contents must have 'root' field")?;

    // Step 5: Construct full path
    let full_path = Path::new(root).join(&payload.path);

    // Step 6: Check if path exists
    if !full_path.exists() {
        return Err(format!("Path '{}' does not exist", payload.path));
    }

    // Step 7: Security check - ensure path is within root
    let canonical_root = Path::new(root)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize root: {}", e))?;

    let canonical_path = full_path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("Path traversal attempt detected".into());
    }

    // Step 8: Prevent deleting root directory itself
    if canonical_path == canonical_root {
        return Err("Cannot delete root directory".into());
    }

    // Step 9: Check if it's a directory and handle recursive flag
    let is_dir = full_path.is_dir();

    if is_dir && !payload.recursive {
        // Check if directory is empty
        let is_empty = fs::read_dir(&full_path)
            .map_err(|e| format!("Failed to check directory: {}", e))?
            .next()
            .is_none();

        if !is_empty {
            return Err("Cannot delete non-empty directory without recursive=true".into());
        }
    }

    // Step 10: Delete file or directory
    if is_dir {
        if payload.recursive {
            fs::remove_dir_all(&full_path)
                .map_err(|e| format!("Failed to delete directory: {}", e))?;
        } else {
            fs::remove_dir(&full_path)
                .map_err(|e| format!("Failed to delete empty directory: {}", e))?;
        }
    } else {
        fs::remove_file(&full_path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    // Step 11: Create event
    let value = serde_json::json!({
        "path": payload.path,
        "was_directory": is_dir,
        "recursive": payload.recursive,
        "deleted_at": chrono::Utc::now().to_rfc3339(),
    });

    let event = create_event(
        block.block_id.clone(),
        "directory.delete",
        value,
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
