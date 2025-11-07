/// Capability: refresh
///
/// Refreshes the directory cache by re-scanning the filesystem.
use super::utils::{read_dir_recursive, read_dir_single};
use super::DirectoryRefreshPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::path::Path;

/// Handler for refresh capability.
///
/// Re-scans the directory and updates Block.contents cache.
/// Reuses the list logic to ensure consistency.
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The block representing the directory
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events with updated directory entries
/// * `Err(String)` - Error description
///
#[capability(id = "directory.refresh", target = "directory")]
fn handle_refresh(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Deserialize payload
    let payload: DirectoryRefreshPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|err| format!("Invalid payload for directory.refresh: {}", err))?;

    // Step 2: Validate block exists
    let block = block.ok_or("Block required for directory.refresh capability")?;

    // Step 3: Get root from block contents
    let root = block
        .contents
        .get("root")
        .and_then(|v| v.as_str())
        .ok_or("Block.contents must have 'root' field")?;

    // Step 4: Validate root path
    let path = Path::new(root);
    if !path.exists() {
        return Err("Root directory does not exist".into());
    }
    if !path.is_dir() {
        return Err("Root path is not a directory".into());
    }

    // Step 5: Security check
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    // Step 6: Read directory entries (reuse list logic)
    let mut entries = Vec::new();

    // Get include_hidden from block contents (if it was set by previous list)
    let include_hidden = block
        .contents
        .get("include_hidden")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Get max_depth from block contents
    let max_depth = block
        .contents
        .get("max_depth")
        .and_then(|v| v.as_u64())
        .map(|v| v as usize);

    if payload.recursive {
        // Recursive refresh
        read_dir_recursive(
            &canonical_path,
            &canonical_path,
            &mut entries,
            include_hidden,
            max_depth,
            0,
        )?;
    } else {
        // Single-level refresh
        read_dir_single(&canonical_path, &mut entries, include_hidden)?;
    }

    // Step 7: Create event with updated entries
    let value = serde_json::json!({
        "root": root,
        "recursive": payload.recursive,
        "include_hidden": include_hidden,
        "max_depth": max_depth,
        "entries": entries,
        "last_updated": chrono::Utc::now().to_rfc3339(),
    });

    let event = create_event(
        block.block_id.clone(),
        "directory.refresh",
        value,
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}

// Note: read_dir_single and read_dir_recursive functions have been moved to utils.rs
// to avoid code duplication with directory_list.rs
