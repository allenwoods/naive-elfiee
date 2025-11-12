/// Capability: rename
///
/// Renames or moves a file or directory.
use super::DirectoryRenamePayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::fs;
use std::path::Path;

/// Handler for rename capability.
///
/// Renames or moves a file/directory. Does not update cache - use refresh for that.
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The block representing the directory
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events indicating rename
/// * `Err(String)` - Error description
///
#[capability(id = "directory.rename", target = "directory")]
fn handle_rename(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Deserialize payload
    let payload: DirectoryRenamePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|err| format!("Invalid payload for directory.rename: {}", err))?;

    // Step 2: Validate block exists
    let block = block.ok_or("Block required for directory.rename capability")?;

    // Step 3: Validate payload
    if payload.old_path.trim().is_empty() {
        return Err("DirectoryRenamePayload.old_path must not be empty".into());
    }
    if payload.new_path.trim().is_empty() {
        return Err("DirectoryRenamePayload.new_path must not be empty".into());
    }

    // Step 4: Get root from block contents
    let root = block
        .contents
        .get("root")
        .and_then(|v| v.as_str())
        .ok_or("Block.contents must have 'root' field")?;

    // Step 5: Construct full paths
    let old_full_path = Path::new(root).join(&payload.old_path);
    let new_full_path = Path::new(root).join(&payload.new_path);

    // Step 6: Check if old path exists
    if !old_full_path.exists() {
        return Err(format!("Path '{}' does not exist", payload.old_path));
    }

    // Step 7: Check for symlink in old path (security)
    let old_metadata = fs::symlink_metadata(&old_full_path)
        .map_err(|e| format!("Failed to read old path metadata: {}", e))?;

    if old_metadata.is_symlink() {
        return Err(format!(
            "Renaming symlinks is not supported for security reasons. \
             Path '{}' is a symbolic link.",
            payload.old_path
        ));
    }

    // Step 8: Check if new path already exists
    if new_full_path.exists() {
        return Err(format!("Path '{}' already exists", payload.new_path));
    }

    // Step 9: Security check - ensure both paths are within root
    let canonical_root = Path::new(root)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize root: {}", e))?;

    let canonical_old_path = old_full_path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize old_path: {}", e))?;

    if !canonical_old_path.starts_with(&canonical_root) {
        return Err("old_path is outside root directory".into());
    }

    // For new_path, check parent directory (since the file doesn't exist yet)
    if let Some(new_parent) = new_full_path.parent() {
        if !new_parent.exists() {
            return Err(format!(
                "Parent directory for new_path '{}' does not exist",
                payload.new_path
            ));
        }

        let canonical_new_parent = new_parent
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize new_path parent: {}", e))?;

        if !canonical_new_parent.starts_with(&canonical_root) {
            return Err("new_path is outside root directory".into());
        }
    }

    // Step 10: Prevent renaming root directory itself
    if canonical_old_path == canonical_root {
        return Err("Cannot rename root directory".into());
    }

    // Step 11: Perform rename (filesystem handles recursive path updates automatically)
    fs::rename(&old_full_path, &new_full_path).map_err(|e| format!("Failed to rename: {}", e))?;

    // Step 12: Create event
    let value = serde_json::json!({
        "old_path": payload.old_path,
        "new_path": payload.new_path,
        "renamed_at": chrono::Utc::now().to_rfc3339(),
    });

    let event = create_event(
        block.block_id.clone(),
        "directory.rename",
        value,
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
