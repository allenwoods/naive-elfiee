//! Terminal initialization command
//!
//! Initializes a new PTY session for a terminal block.

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use specta::specta;
use std::io::Write;
use std::thread;
use tauri::{AppHandle, Emitter, State};

use super::permission::check_terminal_permission;
use super::shell::generate_shell_init;
use super::state::{TerminalSession, TerminalState};
use super::TerminalInitPayload;
use crate::state::AppState;

/// Initialize a new PTY session for a block.
///
/// This command:
/// 1. Verifies the editor has permission for terminal.init
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

    // Verify permissions using capability system
    check_terminal_permission(
        &app_state,
        &payload.file_id,
        &payload.editor_id,
        &block_id,
        "terminal.init",
    )
    .await?;

    // Get the .elf file's temporary directory
    let file_info = app_state
        .files
        .get(&payload.file_id)
        .ok_or_else(|| format!("File '{}' not found", payload.file_id))?;
    let temp_dir = file_info.archive.temp_path();

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
    // The function intercepts when user's home directory path is passed (after ~ expansion)
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
            // Use dot-sourcing (-Command ". 'path'") instead of -File
            // -File runs script in isolated scope, functions don't persist to interactive session
            // Dot-sourcing (.) runs script in current scope, so cd function remains available
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
    // PowerShell initialization is already handled via profile script
    let init_script = generate_shell_init(temp_dir, shell)?;

    if !init_script.is_empty() {
        // Wait for shell to start (give it a moment to initialize)
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
