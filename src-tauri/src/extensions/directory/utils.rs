//! Shared utilities for directory operations
//!
//! This module contains common functions used across multiple directory capabilities
//! to avoid code duplication.

use std::fs;
use std::path::Path;

/// Read directory entries (non-recursive)
///
/// # Arguments
/// * `path` - Directory path to read
/// * `entries` - Mutable vector to append entries to
/// * `include_hidden` - Whether to include hidden files (starting with '.')
///
/// # Returns
/// * `Ok(())` - Entries successfully appended to vector
/// * `Err(message)` - Error description if read fails
pub(super) fn read_dir_single(
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
///
/// # Arguments
/// * `root` - Root directory path for calculating relative paths
/// * `current` - Current directory to read
/// * `entries` - Mutable vector to append entries to
/// * `include_hidden` - Whether to include hidden files
/// * `max_depth` - Maximum recursion depth (None = unlimited)
/// * `current_depth` - Current recursion depth (starts at 0)
///
/// # Returns
/// * `Ok(())` - Entries successfully appended to vector
/// * `Err(message)` - Error description if read fails
pub(super) fn read_dir_recursive(
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
