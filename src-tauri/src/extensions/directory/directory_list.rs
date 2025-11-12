/// Capability: list
///
/// Lists directory contents with optional filtering and recursion.
use super::utils::{read_dir_recursive, read_dir_single};
use super::DirectoryListPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::path::Path;

/// Handler for list capability.
///
/// Reads directory structure and caches it in Block.contents.
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The block representing the directory (must exist)
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events with directory entries
/// * `Err(String)` - Error description
///
#[capability(id = "directory.list", target = "directory")]
fn handle_list(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Deserialize payload
    let payload: DirectoryListPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|err| format!("Invalid payload for directory.list: {}", err))?;

    // Step 2: Validate block exists
    let block = block.ok_or("Block required for directory.list capability")?;

    // Step 3: Get root from block.contents
    let root = block
        .contents
        .get("root")
        .and_then(|v| v.as_str())
        .ok_or("Block.contents must have 'root' field")?;

    // Step 4: Validate payload.path
    if payload.path.trim().is_empty() {
        return Err("DirectoryListPayload.path must not be empty".into());
    }

    // Step 5: Join payload.path as relative path to block's root
    let full_path = Path::new(root).join(&payload.path);

    // Step 6: Validate path exists and is directory
    if !full_path.exists() {
        return Err(format!("Path '{}' does not exist", payload.path));
    }
    if !full_path.is_dir() {
        return Err(format!("Path '{}' is not a directory", payload.path));
    }

    // Step 7: Canonicalize for security check
    let canonical_path = full_path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path '{}': {}", payload.path, e))?;

    let canonical_root = Path::new(root)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize root: {}", e))?;

    // Step 8: Verify path is within root directory
    if !canonical_path.starts_with(&canonical_root) {
        return Err(format!(
            "Path '{}' is outside the root directory",
            payload.path
        ));
    }

    // Step 5: Read directory entries
    let mut entries = Vec::new();

    if payload.recursive {
        // Recursive listing with max_depth
        read_dir_recursive(
            &canonical_path,
            &canonical_path,
            &mut entries,
            payload.include_hidden,
            payload.max_depth,
            0,
        )?;
    } else {
        // Single-level listing
        read_dir_single(&canonical_path, &mut entries, payload.include_hidden)?;
    }

    // Step 6: Create event with entries
    // Note: Store the absolute root path (from block.contents), not the relative payload.path
    let value = serde_json::json!({
        "root": root,  // Changed from payload.root to root (absolute path)
        "recursive": payload.recursive,
        "include_hidden": payload.include_hidden,
        "max_depth": payload.max_depth,
        "entries": entries,
        "last_updated": chrono::Utc::now().to_rfc3339(),
    });

    let event = create_event(
        block.block_id.clone(),
        "directory.list",
        value,
        &cmd.editor_id,
        1, // Placeholder vector clock
    );

    Ok(vec![event])
}

// Note: read_dir_single and read_dir_recursive functions have been moved to utils.rs
// to avoid code duplication with directory_refresh.rs
