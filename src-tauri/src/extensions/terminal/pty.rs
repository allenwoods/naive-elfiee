use portable_pty::{native_pty_system, CommandBuilder, PtySize}; // Removed PtyPair, PtySystem
use serde::{Deserialize, Serialize};
use specta::specta;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State}; // Removed Manager

use crate::state::AppState;

// --- Payloads ---

#[derive(Debug, Clone, Deserialize, Serialize, specta::Type)]
pub struct TerminalInitPayload {
    pub cols: u16,
    pub rows: u16,
    pub block_id: String,
    pub editor_id: String,
    pub file_id: String,     // Required for permission checking
    pub cwd: Option<String>, // Optional working directory
}

#[derive(Debug, Clone, Deserialize, Serialize, specta::Type)]
pub struct TerminalWritePayload {
    pub data: String,
    pub block_id: String,
    pub file_id: String,   // Required for permission checking
    pub editor_id: String, // Required for permission checking
}

#[derive(Debug, Clone, Deserialize, Serialize, specta::Type)]
pub struct TerminalResizePayload {
    pub cols: u16,
    pub rows: u16,
    pub block_id: String,
    pub file_id: String,   // Required for permission checking
    pub editor_id: String, // Required for permission checking
}

// --- State ---

pub struct TerminalSession {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn portable_pty::MasterPty + Send>,
}

pub struct TerminalState {
    pub sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// --- Helper Functions ---

/// Check if an editor has permission to use terminal capabilities on a block.
///
/// This follows the same authorization logic as the engine actor:
/// - Block owner always has access
/// - Otherwise, check grants for "terminal.*" capabilities
async fn check_terminal_permission(
    app_state: &AppState,
    file_id: &str,
    editor_id: &str,
    block_id: &str,
    cap_id: &str, // e.g., "terminal.init", "terminal.write", "terminal.resize"
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

// --- Commands ---

/// Initialize a new PTY session for a block.
#[tauri::command]
#[specta]
pub async fn async_init_terminal(
    app_handle: AppHandle,
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    payload: TerminalInitPayload,
) -> Result<(), String> {
    let block_id = payload.block_id.clone();

    // Verify permissions using capability system
    check_terminal_permission(
        &app_state,
        &payload.file_id,
        &payload.editor_id,
        &block_id,
        "terminal.init",
    )
    .await?;

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: payload.rows,
            cols: payload.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd_builder = if cfg!(target_os = "windows") {
        CommandBuilder::new("powershell")
    } else {
        CommandBuilder::new("bash")
    };

    // Set TERM environment variable for proper terminal emulation
    cmd_builder.env("TERM", "xterm-256color");

    // Set working directory if provided
    if let Some(cwd) = payload.cwd.as_ref() {
        cmd_builder.cwd(cwd);
    }

    let _child = pair
        .slave
        .spawn_command(cmd_builder)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Release slave to allow it to close when child exits
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    // Store session
    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(
            block_id.clone(),
            TerminalSession {
                writer,
                master: pair.master,
            },
        );
    }

    // Spawn reader thread
    let block_id_clone = block_id.clone();
    let app_handle_clone = app_handle.clone();

    thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    let data = &buffer[..n];
                    // Use base64 crate with engine::general_purpose::STANDARD
                    use base64::{engine::general_purpose, Engine as _};
                    let base64_data = general_purpose::STANDARD.encode(data);

                    let event_payload = serde_json::json!({
                        "data": base64_data,
                        "block_id": block_id_clone
                    });

                    let _ = app_handle_clone.emit("pty-out", event_payload);
                }
                Ok(_) => break,  // EOF
                Err(_) => break, // Error
            }
        }
    });

    Ok(())
}

/// Write data to the PTY.
#[tauri::command]
#[specta]
pub async fn write_to_pty(
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    payload: TerminalWritePayload,
) -> Result<(), String> {
    // Verify permissions using capability system
    check_terminal_permission(
        &app_state,
        &payload.file_id,
        &payload.editor_id,
        &payload.block_id,
        "terminal.write",
    )
    .await?;

    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&payload.block_id) {
        write!(session.writer, "{}", payload.data)
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
    } else {
        return Err("Terminal session not found".to_string());
    }

    Ok(())
}

/// Resize the PTY.
#[tauri::command]
#[specta]
pub async fn resize_pty(
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    payload: TerminalResizePayload,
) -> Result<(), String> {
    // Verify permissions using capability system
    check_terminal_permission(
        &app_state,
        &payload.file_id,
        &payload.editor_id,
        &payload.block_id,
        "terminal.resize",
    )
    .await?;

    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&payload.block_id) {
        session
            .master
            .resize(PtySize {
                rows: payload.rows,
                cols: payload.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
    } else {
        return Err("Terminal session not found".to_string());
    }

    Ok(())
}
