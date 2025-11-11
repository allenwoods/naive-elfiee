use super::DirectoryRootPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::path::Path;

#[capability(id = "directory.root", target = "directory")]
pub fn handle_root(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let payload: DirectoryRootPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|err| format!("Invalid payload for directory.root: {}", err))?;

    let block = block.ok_or("Block required for directory.root capability")?;

    let trimmed_root = payload.root.trim();
    if trimmed_root.is_empty() {
        return Err("Root path cannot be empty".into());
    }

    let path = Path::new(trimmed_root);
    if !path.exists() {
        return Err("Root path does not exist".into());
    }
    if !path.is_dir() {
        return Err("Root path must be a directory".into());
    }

    let canonical_root = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize root: {}", e))?;

    let value = serde_json::json!({
        "root": canonical_root.to_string_lossy(),
        "recursive": payload.recursive,
        "include_hidden": payload.include_hidden,
        "max_depth": payload.max_depth,
        "entries": [],
        "last_updated": chrono::Utc::now().to_rfc3339(),
        "watch_enabled": false,
    });

    let event = create_event(
        block.block_id.clone(),
        "directory.root",
        value,
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
