/// Capability: search
///
/// Searches for files matching a pattern.
use super::DirectorySearchPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::fs;
use std::path::Path;

/// Handler for search capability.
///
/// Searches for files by pattern (supports wildcards * and ?).
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The block representing the directory
///
/// # Returns
/// * `Ok(Vec<Event>)` - Events with search results
/// * `Err(String)` - Error description
///
#[capability(id = "directory.search", target = "directory")]
fn handle_search(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Deserialize payload
    let payload: DirectorySearchPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|err| format!("Invalid payload for directory.search: {}", err))?;

    // Step 2: Validate block exists
    let block = block.ok_or("Block required for directory.search capability")?;

    // Step 3: Validate payload
    if payload.pattern.trim().is_empty() {
        return Err("DirectorySearchPayload.pattern must not be empty".into());
    }

    // Step 4: Get root from block contents
    let root = block
        .contents
        .get("root")
        .and_then(|v| v.as_str())
        .ok_or("Block.contents must have 'root' field")?;

    // Step 5: Validate root path
    let path = Path::new(root);
    if !path.exists() {
        return Err(format!("Root path '{}' does not exist", root));
    }
    if !path.is_dir() {
        return Err(format!("Root path '{}' is not a directory", root));
    }

    // Step 6: Security check
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    // Step 7: Search for matching files
    let mut matches = Vec::new();

    if payload.recursive {
        search_recursive(
            &canonical_path,
            &canonical_path,
            &payload.pattern,
            &mut matches,
            payload.include_hidden,
        )?;
    } else {
        search_single(
            &canonical_path,
            &payload.pattern,
            &mut matches,
            payload.include_hidden,
        )?;
    }

    // Step 8: Create event with search results
    let value = serde_json::json!({
        "pattern": payload.pattern,
        "recursive": payload.recursive,
        "include_hidden": payload.include_hidden,
        "matches": matches,
        "searched_at": chrono::Utc::now().to_rfc3339(),
    });

    let event = create_event(
        block.block_id.clone(),
        "directory.search",
        value,
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}

/// Search in a single directory (non-recursive)
fn search_single(
    path: &Path,
    pattern: &str,
    matches: &mut Vec<serde_json::Value>,
    include_hidden: bool,
) -> Result<(), String> {
    for entry in fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Filter hidden files
        if !include_hidden && file_name.starts_with('.') {
            continue;
        }

        // Check if filename matches pattern
        if matches_pattern(&file_name, pattern) {
            let file_type = entry
                .file_type()
                .map_err(|e| format!("Failed to determine entry type: {}", e))?;

            matches.push(serde_json::json!({
                "name": file_name,
                "is_dir": file_type.is_dir(),
                "is_file": file_type.is_file(),
            }));
        }
    }
    Ok(())
}

/// Search recursively
fn search_recursive(
    root: &Path,
    current: &Path,
    pattern: &str,
    matches: &mut Vec<serde_json::Value>,
    include_hidden: bool,
) -> Result<(), String> {
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

        let entry_path = entry.path();

        // Check if filename matches pattern
        if matches_pattern(&file_name, pattern) {
            let relative_path = entry_path
                .strip_prefix(root)
                .map_err(|_| "Failed to calculate relative path".to_string())?
                .to_string_lossy()
                .to_string();

            matches.push(serde_json::json!({
                "name": file_name,
                "path": relative_path,
                "is_dir": file_type.is_dir(),
                "is_file": file_type.is_file(),
            }));
        }

        // Recurse into subdirectories
        if file_type.is_dir() {
            search_recursive(root, &entry_path, pattern, matches, include_hidden)?;
        }
    }
    Ok(())
}

/// Simple pattern matching with wildcards (* and ?)
/// * matches any sequence of characters
/// ? matches any single character
fn matches_pattern(filename: &str, pattern: &str) -> bool {
    let pattern_chars: Vec<char> = pattern.chars().collect();
    let filename_chars: Vec<char> = filename.chars().collect();

    matches_pattern_impl(&filename_chars, 0, &pattern_chars, 0)
}

fn matches_pattern_impl(filename: &[char], f_idx: usize, pattern: &[char], p_idx: usize) -> bool {
    // Both exhausted - match
    if f_idx == filename.len() && p_idx == pattern.len() {
        return true;
    }

    // Pattern exhausted but filename not - no match (unless pattern ends with *)
    if p_idx == pattern.len() {
        return false;
    }

    // Filename exhausted but pattern not - only match if remaining pattern is all *
    if f_idx == filename.len() {
        return pattern[p_idx..].iter().all(|&c| c == '*');
    }

    match pattern[p_idx] {
        '*' => {
            // Try matching 0 or more characters
            // Case 1: * matches nothing (skip * in pattern)
            if matches_pattern_impl(filename, f_idx, pattern, p_idx + 1) {
                return true;
            }
            // Case 2: * matches one or more characters (consume one char from filename)
            matches_pattern_impl(filename, f_idx + 1, pattern, p_idx)
        }
        '?' => {
            // ? matches exactly one character
            matches_pattern_impl(filename, f_idx + 1, pattern, p_idx + 1)
        }
        c => {
            // Literal character must match
            if filename[f_idx] == c {
                matches_pattern_impl(filename, f_idx + 1, pattern, p_idx + 1)
            } else {
                false
            }
        }
    }
}
