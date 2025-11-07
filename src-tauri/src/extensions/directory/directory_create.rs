/// Capability: create
///
/// Creates a new file or directory.
use super::DirectoryCreatePayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::fs;
use std::path::Path;

/// Handler for create capability.
///
/// Creates a file or directory in the filesystem.
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The block representing the directory
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events indicating creation
/// * `Err(String)` - Error description
///
#[capability(id = "directory.create", target = "directory")]
fn handle_create(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Deserialize payload
    let payload: DirectoryCreatePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|err| format!("Invalid payload for directory.create: {}", err))?;

    // Step 2: Validate block exists
    let block = block.ok_or("Block required for directory.create capability")?;

    // Step 3: Validate payload
    if payload.path.trim().is_empty() {
        return Err("DirectoryCreatePayload.path must not be empty".into());
    }

    if payload.item_type != "file" && payload.item_type != "dir" {
        return Err(format!(
            "DirectoryCreatePayload.item_type must be 'file' or 'dir', got '{}'",
            payload.item_type
        ));
    }

    // Step 4: Get root from block contents
    let root = block
        .contents
        .get("root")
        .and_then(|v| v.as_str())
        .ok_or("Block.contents must have 'root' field")?;

    // Step 5: Construct full path
    let full_path = Path::new(root).join(&payload.path);

    // Step 6: Canonicalize root for security check
    let canonical_root = Path::new(root)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize root: {}", e))?;

    // Step 7: Security check on PARENT directory BEFORE any file creation (TOCTOU mitigation)
    if let Some(parent) = full_path.parent() {
        // Ensure parent exists
        if !parent.exists() {
            return Err(format!(
                "Parent directory for '{}' does not exist",
                payload.path
            ));
        }

        // Canonicalize parent and verify it's within root
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize parent directory: {}", e))?;

        if !canonical_parent.starts_with(&canonical_root) {
            return Err(format!(
                "Path '{}' attempts to escape root directory",
                payload.path
            ));
        }
    }

    // Step 8: Check if path already exists
    if full_path.exists() {
        return Err(format!("Path '{}' already exists", payload.path));
    }

    // Step 9: Now safe to create file/directory
    if payload.item_type == "file" {
        fs::write(&full_path, &payload.content)
            .map_err(|e| format!("Failed to create file: {}", e))?;
    } else {
        fs::create_dir(&full_path).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Step 10: Final verification (paranoia check)
    let canonical_path = full_path
        .canonicalize()
        .map_err(|e| format!("Failed to verify created path: {}", e))?;

    if !canonical_path.starts_with(&canonical_root) {
        // Security violation detected - rollback
        let rollback_result = if payload.item_type == "file" {
            fs::remove_file(&full_path)
        } else {
            fs::remove_dir(&full_path)
        };

        if let Err(e) = rollback_result {
            eprintln!("Failed to rollback insecure creation: {}", e);
        }

        return Err(format!(
            "Security violation: created path '{}' is outside root directory",
            payload.path
        ));
    }

    // Step 11: Create event
    let value = serde_json::json!({
        "path": payload.path,
        "item_type": payload.item_type,
        "created_at": chrono::Utc::now().to_rfc3339(),
    });

    let event = create_event(
        block.block_id.clone(),
        "directory.create",
        value,
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
