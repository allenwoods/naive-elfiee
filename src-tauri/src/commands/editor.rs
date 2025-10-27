use crate::models::{Command, Editor, Grant};
use crate::state::AppState;
use specta::specta;
use tauri::State;

/// Create a new editor for the specified file.
///
/// This generates a Command with editor.create capability and processes it through
/// the engine actor. The new editor is added to the file's state via event replay.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file
/// * `name` - Display name for the new editor
///
/// # Returns
/// * `Ok(Editor)` - The newly created editor
/// * `Err(message)` - Error description if creation fails
#[tauri::command]
#[specta]
pub async fn create_editor(
    file_id: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<Editor, String> {
    // Get engine handle for this file
    let handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Get current active editor (or use "system")
    let creator_editor_id = state
        .get_active_editor(&file_id)
        .unwrap_or_else(|| "system".to_string());

    // Create command to create editor
    let cmd = Command::new(
        creator_editor_id,
        "editor.create".to_string(),
        "".to_string(), // No block_id for system commands
        serde_json::json!({ "name": name }),
    );

    // Process command
    let events = handle.process_command(cmd).await?;

    // Extract editor_id from created event
    // The event entity is the new editor_id
    if let Some(event) = events.first() {
        let editor_id = event.entity.clone();
        let editor_name = event
            .value
            .get("name")
            .and_then(|v| v.as_str())
            .ok_or("Missing name in event")?
            .to_string();

        Ok(Editor {
            editor_id,
            name: editor_name,
        })
    } else {
        Err("No events generated for editor creation".to_string())
    }
}

/// List all editors for the specified file.
///
/// Reads the editors from the StateProjector which is built from event replay.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file
///
/// # Returns
/// * `Ok(Vec<Editor>)` - List of all editors
/// * `Err(message)` - Error if file is not open
#[tauri::command]
#[specta]
pub async fn list_editors(
    file_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Editor>, String> {
    // Get engine handle for this file
    let handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Get all editors from engine actor
    let editors_map = handle.get_all_editors().await;
    let editors: Vec<Editor> = editors_map.values().cloned().collect();

    Ok(editors)
}

/// Get a specific editor by ID.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file
/// * `editor_id` - Unique identifier of the editor
///
/// # Returns
/// * `Ok(Editor)` - The requested editor
/// * `Err(message)` - Error if file not open or editor not found
#[tauri::command]
#[specta]
pub async fn get_editor(
    file_id: String,
    editor_id: String,
    state: State<'_, AppState>,
) -> Result<Editor, String> {
    // Get engine handle for this file
    let handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Get all editors and find the requested one
    let editors = handle.get_all_editors().await;
    editors
        .get(&editor_id)
        .cloned()
        .ok_or_else(|| format!("Editor '{}' not found", editor_id))
}

/// Set the active editor for the specified file.
///
/// This is a UI state operation and is not persisted to the .elf file.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file
/// * `editor_id` - Unique identifier of the editor to set as active
///
/// # Returns
/// * `Ok(())` - Success
/// * `Err(message)` - Error if file or editor not found
#[tauri::command]
#[specta]
pub async fn set_active_editor(
    file_id: String,
    editor_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Verify file is open
    let _ = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Set active editor
    state.set_active_editor(file_id, editor_id);

    Ok(())
}

/// Get the currently active editor for the specified file.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file
///
/// # Returns
/// * `Ok(Option<String>)` - Editor ID if one is active, None otherwise
/// * `Err(message)` - Error if file is not open
#[tauri::command]
#[specta]
pub async fn get_active_editor(
    file_id: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    // Verify file is open
    let _ = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    Ok(state.get_active_editor(&file_id))
}

/// List all grants for the specified file.
///
/// Returns all capability grants in the system as Grant objects.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file
///
/// # Returns
/// * `Ok(Vec<Grant>)` - List of all grants
/// * `Err(message)` - Error if file is not open
#[tauri::command]
#[specta]
pub async fn list_grants(
    file_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Grant>, String> {
    // Get engine handle for this file
    let handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Get all grants from engine actor
    let grants_map = handle.get_all_grants().await;

    // Convert to Grant objects
    let mut grants = Vec::new();
    for (editor_id, grant_list) in grants_map {
        for (cap_id, block_id) in grant_list {
            grants.push(Grant::new(editor_id.clone(), cap_id, block_id));
        }
    }

    Ok(grants)
}

/// Get grants for a specific editor.
///
/// # Arguments
/// * `file_id` - Unique identifier of the file
/// * `editor_id` - Unique identifier of the editor
///
/// # Returns
/// * `Ok(Vec<Grant>)` - List of grants for the editor
/// * `Err(message)` - Error if file is not open
#[tauri::command]
#[specta]
pub async fn get_editor_grants(
    file_id: String,
    editor_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Grant>, String> {
    // Get engine handle for this file
    let handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Get grants for this editor
    let grant_list = handle.get_editor_grants(editor_id.clone()).await;

    // Convert to Grant objects
    let grants = grant_list
        .into_iter()
        .map(|(cap_id, block_id)| Grant::new(editor_id.clone(), cap_id, block_id))
        .collect();

    Ok(grants)
}

/// Get grants for a specific block.
///
/// Returns all grants that apply to this block (including wildcard grants).
///
/// # Arguments
/// * `file_id` - Unique identifier of the file
/// * `block_id` - Unique identifier of the block
///
/// # Returns
/// * `Ok(Vec<Grant>)` - List of grants for the block
/// * `Err(message)` - Error if file is not open
#[tauri::command]
#[specta]
pub async fn get_block_grants(
    file_id: String,
    block_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Grant>, String> {
    // Get engine handle for this file
    let handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // Get grants for this block
    let grant_list = handle.get_block_grants(block_id).await;

    // Convert to Grant objects
    let grants = grant_list
        .into_iter()
        .map(|(editor_id, cap_id, block_id)| Grant::new(editor_id, cap_id, block_id))
        .collect();

    Ok(grants)
}
