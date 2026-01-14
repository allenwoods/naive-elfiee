//! Terminal permission checking
//!
//! Provides authorization checks for terminal operations using the CBAC system.

use crate::state::AppState;

/// Check if an editor has permission to use terminal capabilities on a block.
///
/// This follows the same authorization logic as the engine actor:
/// - Block owner always has access
/// - Otherwise, check grants for the specific terminal capability
///
/// # Arguments
/// * `app_state` - Application state containing engine manager
/// * `file_id` - The file containing the terminal block
/// * `editor_id` - The editor attempting the operation
/// * `block_id` - The terminal block being accessed
/// * `cap_id` - The capability being invoked (e.g., "terminal.init", "terminal.write")
///
/// # Returns
/// * `Ok(())` - If the editor is authorized
/// * `Err(String)` - If authorization fails
pub async fn check_terminal_permission(
    app_state: &AppState,
    file_id: &str,
    editor_id: &str,
    block_id: &str,
    cap_id: &str,
) -> Result<(), String> {
    // Get engine handle for this file
    let engine = app_state
        .engine_manager
        .get_engine(file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Get block
    let block = engine
        .get_block(block_id.to_string())
        .await
        .ok_or_else(|| format!("Block '{}' not found", block_id))?;

    // Check if editor is the block owner
    if block.owner == editor_id {
        return Ok(());
    }

    // Check grants
    let grants = engine.get_all_grants().await;
    if let Some(editor_grants) = grants.get(editor_id) {
        let has_grant = editor_grants
            .iter()
            .any(|(cap, blk)| cap == cap_id && (blk == block_id || blk == "*"));
        if has_grant {
            return Ok(());
        }
    }

    Err(format!(
        "Authorization failed: {} does not have permission for {} on block {}",
        editor_id, cap_id, block_id
    ))
}
