use portable_pty::{native_pty_system, CommandBuilder, PtySize}; // Removed PtyPair, PtySystem
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State}; // Removed Manager
use specta::specta;

// --- Payloads ---

#[derive(Debug, Clone, Deserialize, Serialize, specta::Type)]
pub struct TerminalInitPayload {
    pub cols: u16,
    pub rows: u16,
    pub block_id: String,
    pub editor_id: String,
    pub cwd: Option<String>, // Optional working directory
}

#[derive(Debug, Clone, Deserialize, Serialize, specta::Type)]
pub struct TerminalWritePayload {
    pub data: String,
    pub block_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, specta::Type)]
pub struct TerminalResizePayload {
    pub cols: u16,
    pub rows: u16,
    pub block_id: String,
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

// --- Commands ---

/// Initialize a new PTY session for a block.
#[tauri::command]
#[specta]
pub async fn async_init_terminal(
    app_handle: AppHandle,
    state: State<'_, TerminalState>,
    payload: TerminalInitPayload,
) -> Result<(), String> {
    let block_id = payload.block_id.clone();
    
    // TODO: Verify permissions using editor_id and block_id if needed
    // For now, we assume access is allowed if they can call this command with a valid block_id

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

    let mut reader = pair.master.try_clone_reader().map_err(|e| format!("Failed to clone reader: {}", e))?;
    let writer = pair.master.take_writer().map_err(|e| format!("Failed to take writer: {}", e))?;

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
                    use base64::{Engine as _, engine::general_purpose};
                    let base64_data = general_purpose::STANDARD.encode(data);
                    
                    let event_payload = serde_json::json!({
                        "data": base64_data,
                        "block_id": block_id_clone
                    });

                    let _ = app_handle_clone.emit("pty-out", event_payload);
                }
                Ok(_) => break, // EOF
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
    payload: TerminalWritePayload,
) -> Result<(), String> {
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
    payload: TerminalResizePayload,
) -> Result<(), String> {
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
