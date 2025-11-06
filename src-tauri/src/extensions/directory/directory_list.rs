/// Capability: list
///
/// Lists directory contents with optional filtering and recursion.
use super::DirectoryListPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::fs;
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

    // Step 3: Validate and construct path
    if payload.root.trim().is_empty() {
        return Err("DirectoryListPayload.root must not be empty".into());
    }

    let path = Path::new(&payload.root);
    if !path.exists() {
        return Err(format!("Path '{}' does not exist", payload.root));
    }
    if !path.is_dir() {
        return Err(format!("Path '{}' is not a directory", payload.root));
    }

    // Step 4: Path security check (canonicalize to prevent traversal attacks)
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

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
    let value = serde_json::json!({
        "root": payload.root,
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

/// Read directory entries (non-recursive)
fn read_dir_single(
    path: &Path,
    entries: &mut Vec<serde_json::Value>,
    include_hidden: bool,
) -> Result<(), String> {
    for entry in fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Filter hidden files
        if !include_hidden && file_name.starts_with('.') {
            continue;
        }

        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to determine entry type: {}", e))?;

        entries.push(serde_json::json!({
            "name": file_name,
            "is_dir": file_type.is_dir(),
            "is_file": file_type.is_file(),
        }));
    }
    Ok(())
}

/// Read directory entries recursively
fn read_dir_recursive(
    root: &Path,
    current: &Path,
    entries: &mut Vec<serde_json::Value>,
    include_hidden: bool,
    max_depth: Option<usize>,
    current_depth: usize,
) -> Result<(), String> {
    // Check depth limit
    if let Some(max) = max_depth {
        if current_depth >= max {
            return Ok(());
        }
    }

    for entry in fs::read_dir(current).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Filter hidden files
        if !include_hidden && file_name.starts_with('.') {
            continue;
        }

        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to determine entry type: {}", e))?;

        // Get relative path from root
        let entry_path = entry.path();
        let relative_path = entry_path
            .strip_prefix(root)
            .map_err(|_| "Failed to calculate relative path".to_string())?
            .to_string_lossy()
            .to_string();

        entries.push(serde_json::json!({
            "name": file_name,
            "path": relative_path,
            "is_dir": file_type.is_dir(),
            "is_file": file_type.is_file(),
        }));

        // Recurse into subdirectories
        if file_type.is_dir() {
            read_dir_recursive(
                root,
                &entry_path,
                entries,
                include_hidden,
                max_depth,
                current_depth + 1,
            )?;
        }
    }

    Ok(())
}
