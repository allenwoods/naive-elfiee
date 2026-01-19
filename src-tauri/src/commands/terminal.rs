//! Terminal PTY commands
//!
//! Tauri commands for terminal PTY operations. These commands:
//! 1. Call the corresponding Capability for authorization
//! 2. Execute the actual PTY operation
//!
//! The Capabilities are defined in `extensions/terminal/` and handle
//! permission checking via CBAC (Capability-Based Access Control).

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use specta::specta;
use std::io::Write;
use std::thread;
use tauri::{AppHandle, Emitter, State};

use crate::extensions::terminal::{
    generate_shell_init, TerminalInitPayload, TerminalResizePayload, TerminalSession,
    TerminalState, TerminalWritePayload,
};
use crate::models::Command;
use crate::state::AppState;

/// Initialize a new PTY session for a block.
///
/// This command:
/// 1. Executes terminal.init Capability for authorization
/// 2. Creates a PTY with the specified dimensions
/// 3. Spawns a shell process (bash/zsh on Unix, PowerShell on Windows)
/// 4. Sets up the working directory to the .elf temp directory
/// 5. Injects shell initialization for `cd ~` override
/// 6. Starts a reader thread to emit PTY output as Tauri events
///
/// # Arguments
/// * `app_handle` - Tauri app handle for emitting events
/// * `state` - Terminal state for session management
/// * `app_state` - Application state for file/engine access
/// * `payload` - Initialization parameters (cols, rows, block_id, etc.)
///
/// # Returns
/// * `Ok(())` - PTY session created successfully
/// * `Err(String)` - Error message if initialization fails
#[tauri::command]
#[specta]
pub async fn async_init_terminal(
    app_handle: AppHandle,
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    payload: TerminalInitPayload,
) -> Result<(), String> {
    let block_id = payload.block_id.clone();

    // Step 1: Execute terminal.init Capability for authorization
    let engine = app_state
        .engine_manager
        .get_engine(&payload.file_id)
        .ok_or_else(|| format!("File '{}' is not open", payload.file_id))?;

    let cmd = Command::new(
        payload.editor_id.clone(),
        "terminal.init".to_string(),
        block_id.clone(),
        serde_json::json!({
            "cols": payload.cols,
            "rows": payload.rows,
            "cwd": payload.cwd
        }),
    );

    // This will check authorization and optionally generate audit events
    engine
        .process_command(cmd)
        .await
        .map_err(|e| format!("Authorization failed: {}", e))?;

    // Step 2: Get the .elf file's temporary directory
    let file_info = app_state
        .files
        .get(&payload.file_id)
        .ok_or_else(|| format!("File '{}' not found", payload.file_id))?;
    let temp_dir = file_info.archive.temp_path();

    // Step 3: Create PTY
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: payload.rows,
            cols: payload.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Determine shell type
    let shell = if cfg!(target_os = "windows") {
        "powershell"
    } else {
        "bash"
    };

    // For PowerShell, create initialization script with cd override
    let profile_script_path = if cfg!(target_os = "windows") {
        let profile_path = std::path::Path::new(temp_dir).join("elfiee_terminal_init.ps1");
        let temp_dir_str = temp_dir
            .to_str()
            .ok_or("Failed to convert temp directory path to string")?;
        let profile_script = format!(
            r#"# Set UTF-8 encoding for proper Chinese character display
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:ELF_WORK_DIR = "{}"
# Remove built-in 'cd' alias first - aliases take precedence over functions!
Remove-Item alias:cd -Force -ErrorAction SilentlyContinue
function global:cd {{
    param([string]$Path = $null)
    # Check if path equals user's home directory (PowerShell expands ~ to $HOME)
    if ($Path -eq $HOME -or $Path -eq "~") {{
        Set-Location $env:ELF_WORK_DIR
    }} elseif ($null -eq $Path -or $Path -eq "") {{
        Set-Location $HOME
    }} else {{
        Set-Location $Path
    }}
}}
"#,
            temp_dir_str
        );
        std::fs::write(&profile_path, profile_script)
            .map_err(|e| format!("Failed to write PowerShell profile: {}", e))?;
        Some(profile_path)
    } else {
        None
    };

    let mut cmd_builder = if cfg!(target_os = "windows") {
        if let Some(profile_path) = profile_script_path {
            let mut builder = CommandBuilder::new("powershell");
            let dot_source_cmd = format!(". '{}'", profile_path.to_str().unwrap());
            builder.args(&[
                "-NoLogo",
                "-NoExit",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &dot_source_cmd,
            ]);
            builder
        } else {
            CommandBuilder::new("powershell")
        }
    } else {
        CommandBuilder::new("bash")
    };

    // Set TERM environment variable for proper terminal emulation
    cmd_builder.env("TERM", "xterm-256color");

    // Set working directory to .elf temporary directory (or use provided cwd)
    if let Some(cwd) = &payload.cwd {
        cmd_builder.cwd(cwd);
    } else {
        cmd_builder.cwd(temp_dir);
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
    let mut writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    // Generate and inject shell initialization script (only for bash/zsh)
    let init_script = generate_shell_init(temp_dir, shell)?;

    if !init_script.is_empty() {
        // Wait for shell to start
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Write initialization script to shell
        write!(writer, "{}\n", init_script)
            .map_err(|e| format!("Failed to write init script: {}", e))?;
    }

    // Create shutdown channel for thread cleanup
    let (shutdown_tx, shutdown_rx) = std::sync::mpsc::channel();

    // Store session
    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(
            block_id.clone(),
            TerminalSession {
                writer,
                master: pair.master,
                shutdown_tx,
            },
        );
    }

    // Spawn reader thread
    let block_id_clone = block_id.clone();
    let app_handle_clone = app_handle.clone();

    thread::spawn(move || {
        use std::io::Read;

        let mut buffer = [0u8; 1024];
        loop {
            // Check for shutdown signal (non-blocking)
            if shutdown_rx.try_recv().is_ok() {
                break;
            }

            match reader.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    let data = &buffer[..n];
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
///
/// This command forwards user input from the frontend terminal (xterm.js)
/// to the backend PTY process.
///
/// # Arguments
/// * `state` - Terminal state containing active sessions
/// * `app_state` - Application state for permission checking
/// * `payload` - Write parameters (data, block_id, file_id, editor_id)
///
/// # Returns
/// * `Ok(())` - Data written successfully
/// * `Err(String)` - Error if session not found or write fails
#[tauri::command]
#[specta]
pub async fn write_to_pty(
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    payload: TerminalWritePayload,
) -> Result<(), String> {
    // Execute terminal.write Capability for authorization
    let engine = app_state
        .engine_manager
        .get_engine(&payload.file_id)
        .ok_or_else(|| format!("File '{}' is not open", payload.file_id))?;

    let cmd = Command::new(
        payload.editor_id.clone(),
        "terminal.write".to_string(),
        payload.block_id.clone(),
        serde_json::json!({ "data": payload.data }),
    );

    engine
        .process_command(cmd)
        .await
        .map_err(|e| format!("Authorization failed: {}", e))?;

    // Execute PTY write operation
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
///
/// This command updates the PTY window dimensions when the frontend
/// terminal viewport changes size.
///
/// # Arguments
/// * `state` - Terminal state containing active sessions
/// * `app_state` - Application state for permission checking
/// * `payload` - Resize parameters (cols, rows, block_id, file_id, editor_id)
///
/// # Returns
/// * `Ok(())` - PTY resized successfully
/// * `Err(String)` - Error if session not found or resize fails
#[tauri::command]
#[specta]
pub async fn resize_pty(
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    payload: TerminalResizePayload,
) -> Result<(), String> {
    // Execute terminal.resize Capability for authorization
    let engine = app_state
        .engine_manager
        .get_engine(&payload.file_id)
        .ok_or_else(|| format!("File '{}' is not open", payload.file_id))?;

    let cmd = Command::new(
        payload.editor_id.clone(),
        "terminal.resize".to_string(),
        payload.block_id.clone(),
        serde_json::json!({
            "cols": payload.cols,
            "rows": payload.rows
        }),
    );

    engine
        .process_command(cmd)
        .await
        .map_err(|e| format!("Authorization failed: {}", e))?;

    // Execute PTY resize operation
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

/// Close a PTY session.
///
/// This command:
/// 1. Executes terminal.close Capability for authorization
/// 2. Signals the reader thread to stop
/// 3. Removes the session from state
/// 4. Drops the PTY resources (which terminates the child process)
///
/// Note: Content saving should be handled by the frontend before calling this.
/// The frontend has access to the xterm.js buffer and should call terminal.save
/// capability before closing the session.
///
/// # Arguments
/// * `state` - Terminal state containing active sessions
/// * `app_state` - Application state for permission checking
/// * `file_id` - The file containing the terminal block
/// * `block_id` - The terminal block being closed
/// * `editor_id` - The editor closing the session
///
/// # Returns
/// * `Ok(())` - Session closed successfully (or was already closed)
/// * `Err(String)` - Error if permission check fails
#[tauri::command]
#[specta]
pub async fn close_terminal_session(
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    file_id: String,
    block_id: String,
    editor_id: String,
) -> Result<(), String> {
    // Execute terminal.close Capability for authorization
    let engine = app_state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    let cmd = Command::new(
        editor_id.clone(),
        "terminal.close".to_string(),
        block_id.clone(),
        serde_json::json!({}),
    );

    engine
        .process_command(cmd)
        .await
        .map_err(|e| format!("Authorization failed: {}", e))?;

    // Execute PTY close operation
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.remove(&block_id) {
        // Signal the reader thread to stop
        let _ = session.shutdown_tx.send(());

        // Dropping the session will drop the master PTY
        drop(session);
    }
    Ok(())
}
