/// Capability: export
///
/// Export files from Directory Block to external file system.
///
/// **ARCHITECTURE NOTE**: This capability follows a split architecture:
/// 1. **Capability Handler** (this file): Performs authorization check and generates audit event
/// 2. **Tauri Command** (future): Performs actual file I/O operations
///
/// This separation allows the event log to remain pure (no I/O side effects)
/// while still enforcing CBAC authorization for export operations.
use super::DirectoryExportPayload;
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use serde_json::json;

/// Handler for directory.export capability.
///
/// This handler performs authorization and creates an audit event.
/// The actual export I/O is performed by a Tauri command after this handler succeeds.
///
/// # Workflow
/// 1. Frontend calls Tauri command `export_directory`
/// 2. Tauri command calls this capability handler for authorization
/// 3. If authorized, handler returns audit event
/// 4. Tauri command proceeds with file I/O
/// 5. All events are committed to event store
///
/// # Arguments
/// * `cmd` - The command containing the payload
/// * `block` - The Directory Block to export from
///
/// # Returns
/// * `Ok(Vec<Event>)` - Audit event to be committed
/// * `Err(String)` - Error if unauthorized or invalid payload
///
#[capability(id = "directory.export", target = "directory")]
fn handle_export(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Step 1: Validate block exists
    let block = block.ok_or("Block required for directory.export")?;

    if block.block_type != "directory" {
        return Err(format!(
            "Expected block_type 'directory', got '{}'",
            block.block_type
        ));
    }

    // Step 2: Deserialize and validate payload
    let payload: DirectoryExportPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for directory.export: {}", e))?;

    if payload.target_path.trim().is_empty() {
        return Err("target_path cannot be empty".to_string());
    }

    // Step 3: Validate source_path if specified
    if let Some(ref source) = payload.source_path {
        let entries = block
            .contents
            .get("entries")
            .and_then(|v| v.as_object())
            .ok_or("Invalid directory structure")?;

        if !entries.contains_key(source) {
            return Err(format!("source_path '{}' not found in directory", source));
        }
    }

    // Step 4: Create audit event (actual I/O happens in Tauri command)
    let event = create_event(
        block.block_id.clone(),
        "directory.export",
        json!({
            "target_path": payload.target_path,
            "source_path": payload.source_path,
        }),
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
