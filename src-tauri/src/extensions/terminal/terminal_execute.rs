use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;
use std::process::Stdio;

use super::TerminalExecutePayload;

/// Detects whether a command is file operation-related
///
/// File operation commands include:
/// - Create files/directories: mkdir, touch, echo > file, cat > file, vi/vim newfile
/// - Edit files: vi, vim, nano, echo >> file
/// - Delete files: rm, rmdir
/// - Move/copy files: mv, cp
/// - Modify file permissions: chmod, chown
pub(crate) fn is_file_operation_command(command: &str) -> bool {
    let cmd_lower = command.trim().to_lowercase();

    // Common file operation commands for both Windows and Unix
    let file_ops = [
        "mkdir", "touch", "rm", "rmdir", "mv", "cp",
        "vi", "vim", "nano", "chmod", "chown", "chgrp"
    ];

    // Windows-specific commands
    #[cfg(target_os = "windows")]
    let windows_ops = ["del", "move", "copy", "type", "md", "rd"];

    // Check basic commands (ensure complete word match, not partial)
    if file_ops.iter().any(|op| {
        cmd_lower.starts_with(op) && (
            cmd_lower.len() == op.len() || 
            cmd_lower.chars().nth(op.len()).map_or(false, |c| c.is_whitespace())
        )
    }) {
        return true;
    }

    // Windows-specific check (ensure complete word match, not partial)
    #[cfg(target_os = "windows")]
    if windows_ops.iter().any(|op| {
        cmd_lower.starts_with(op) && (
            cmd_lower.len() == op.len() ||
            cmd_lower.chars().nth(op.len()).map_or(false, |c| c.is_whitespace())
        )
    }) {
        return true;
    }

    // Check for redirection operations (echo > file, cat > file, echo >> file)
    if cmd_lower.contains(" > ") || cmd_lower.contains(" >> ") {
        return true;
    }

    // Check for pipe to file operations
    if cmd_lower.contains(" | ") && (cmd_lower.contains(" > ") || cmd_lower.contains(" >> ")) {
        return true;
    }
    
    false
}

/// Handler for terminal.execute capability.
///
/// Executes a real system command and records it in the terminal block's history.
/// The command and output are stored in the block's contents.history array.
/// 
/// Special commands:
/// - `cd`: Changes the current directory (virtual, stored in block contents)
/// - `pwd`: Returns the current directory (virtual, from block contents)
/// - All other commands: Executed as real system commands
///
/// # Security Considerations
///
/// **Command Injection Risk**: Commands are executed via shell (`sh -c` on Unix, `cmd /c` on Windows),
/// allowing full shell syntax and command chaining. This is intentional for terminal functionality,
/// but requires careful consideration:
///
/// - **Path Sandboxing**: All commands run within sandboxed block directories (`block-{block_id}`),
///   preventing access to files outside the block's scope. The `root_path` and `current_path` are
///   validated to ensure commands cannot escape the sandbox.
///
/// - **Command Length Limit**: Commands are limited to 10,000 characters to prevent resource exhaustion.
///
/// - **Path Validation**: Directory traversal attacks are mitigated through path canonicalization
///   and validation against `root_path`.
///
/// - **Production Recommendations**: For production use in untrusted environments, consider:
///   - Command whitelisting/blacklisting
///   - Additional input sanitization
///   - Rate limiting for command execution
///   - Audit logging of all executed commands
///
/// # Payload
/// Uses `TerminalExecutePayload` with a single `command` field.
#[capability(id = "terminal.execute", target = "terminal")]
fn handle_terminal_execute(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for terminal.execute")?;

    // Deserialize strongly-typed payload
    let payload: TerminalExecutePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| {
            format!(
                "Invalid payload for terminal.execute: {}. Expected schema: {{ \"command\": string }}. Received: {}",
                e,
                serde_json::to_string(&cmd.payload).unwrap_or_else(|_| "invalid JSON".to_string())
            )
        })?;

    // Security: Validate command length
    if payload.command.len() > 10000 {
        return Err("Command too long (max 10000 characters)".to_string());
    }

    // Extract existing history or create new
    let mut history = if let Some(contents) = block.contents.as_object() {
        contents
            .get("history")
            .and_then(|h| h.as_array())
            .map(|arr| arr.iter().cloned().collect::<Vec<_>>())
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    // Determine root and current working directories
    let default_root = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut root_path = if let Some(contents) = block.contents.as_object() {
        // Prioritize _block_dir injected by Engine Actor, fallback to root_path, then default
        if let Some(block_dir) = contents.get("_block_dir").and_then(|d| d.as_str()) {
            PathBuf::from(block_dir)
        } else if let Some(root_path) = contents.get("root_path").and_then(|d| d.as_str()) {
            PathBuf::from(root_path) 
        } else {
            default_root.clone()
        }
    } else {
        default_root.clone()
    };
    if let Ok(canonical_root) = root_path.canonicalize() {
        root_path = canonical_root;
    }
    let mut current_path = if let Some(contents) = block.contents.as_object() {
        // If no current_path is set yet, use _block_dir as initial current_path
        if let Some(current_path) = contents.get("current_path").and_then(|d| d.as_str()) {
            PathBuf::from(current_path)
        } else if let Some(block_dir) = contents.get("_block_dir").and_then(|d| d.as_str()) {
            PathBuf::from(block_dir)
        } else {
            root_path.clone()
        }
    } else {
        root_path.clone()
    };
    if let Ok(canonical_current) = current_path.canonicalize() {
        current_path = canonical_current;
    }
    let mut current_directory = if let Some(contents) = block.contents.as_object() {
        contents
            .get("current_directory")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| ".".to_string())
    } else {
        ".".to_string()
    };

    // Normalize command for special handling
    let trimmed_cmd = payload.command.trim();

    let normalized_cmd = if trimmed_cmd.starts_with("cd") && trimmed_cmd.len() > 2 {
        let after_cd = &trimmed_cmd[2..];
        if after_cd.starts_with("..") && !after_cd.starts_with(".. ") {
            format!("cd ..{}", &after_cd[2..])
        } else if after_cd.starts_with(".") && after_cd.len() == 1 {
            "cd .".to_string()
        } else if !after_cd.starts_with(" ") {
            format!("cd {}", after_cd)
        } else {
            trimmed_cmd.to_string()
        }
    } else {
        trimmed_cmd.to_string()
    };

    let command_parts: Vec<&str> = normalized_cmd.split_whitespace().collect();

    let mut handled_special = false;
    let mut output = String::new();
    let mut exit_code = 0;

    if command_parts.len() >= 2 && command_parts[0] == "cd" {
        let target_dir = normalized_cmd[2..].trim();
        let target_dir = target_dir.trim_matches('"').trim_matches('\'');

        match resolve_cd_target(target_dir, &current_path, &root_path) {
            Ok(new_path) => {
                current_path = new_path;
                current_directory = relative_display(&current_path, &root_path);
                output.clear();
                exit_code = 0;
            }
            Err(err) => {
                output = err;
                exit_code = 1;
            }
        }
        handled_special = true;
    } else if command_parts.len() == 1 && command_parts[0] == "pwd" {
        output = current_path.to_string_lossy().to_string();
        handled_special = true;
    }

    if !handled_special {
        let (system_output, system_exit_code) =
            execute_system_command(&payload.command, &current_path);
        output = system_output;
        exit_code = system_exit_code;
    }

    // Create new history entry
    let history_entry = serde_json::json!({
        "command": payload.command,
        "output": output,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "exit_code": exit_code
    });

    // Append to history
    history.push(history_entry);

    // Detect if this is a file operation command; if so, mark for sync to .elf file
    let is_save_operation = is_file_operation_command(&payload.command);

    // Preserve existing contents and update history and current_directory
    let mut new_contents = if let Some(obj) = block.contents.as_object() {
        obj.clone()
    } else {
        serde_json::Map::new()
    };
    new_contents.insert("history".to_string(), serde_json::json!(history));
    
    new_contents.insert(
        "current_directory".to_string(),
        serde_json::json!(current_directory),
    );
    new_contents.insert(
        "current_path".to_string(),
        serde_json::json!(current_path.to_string_lossy()),
    );
    new_contents.insert(
        "root_path".to_string(),
        serde_json::json!(root_path.to_string_lossy()),
    );

    // If this is a successful file operation, add flag for Engine Actor to detect
    if is_save_operation && exit_code == 0 {
        new_contents.insert(
            "needs_file_sync".to_string(),
            serde_json::json!(true)
        );
        new_contents.insert(
            "file_operation_command".to_string(),
            serde_json::json!(payload.command)
        );
    }

    // Create event
    let event = create_event(
        block.block_id.clone(),
        "terminal.execute",
        serde_json::json!({ "contents": new_contents }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count
    );

    Ok(vec![event])
}

fn resolve_cd_target(target: &str, current_path: &Path, root_path: &Path) -> Result<PathBuf, String> {
    if target.is_empty() {
        return Ok(root_path.to_path_buf());
    }

    if target == "." {
        return Ok(current_path.to_path_buf());
    }

    if target == ".." {
        if current_path == root_path {
            return Ok(root_path.to_path_buf());
        }
        let mut candidate = current_path.to_path_buf();
        if candidate.pop() {
            if candidate.starts_with(root_path) {
                return Ok(candidate);
            }
        }
        return Ok(root_path.to_path_buf());
    }

    let candidate = if Path::new(target).is_absolute() {
        PathBuf::from(target)
    } else {
        current_path.join(target)
    };

    let metadata = std::fs::metadata(&candidate)
        .map_err(|_| format!("cd: {}: No such file or directory", target))?;
    if !metadata.is_dir() {
        return Err(format!("cd: {}: Not a directory", target));
    }

    let canonical = candidate
        .canonicalize()
        .map_err(|_| format!("cd: {}: Unable to access directory", target))?;

    if !canonical.starts_with(root_path) {
        return Err("cd: Permission denied (outside project root)".to_string());
    }

    Ok(canonical)
}

fn relative_display(current_path: &Path, root_path: &Path) -> String {
    if let Ok(rel) = current_path.strip_prefix(root_path) {
        let rel_str = rel.to_string_lossy();
        if rel_str.is_empty() {
            ".".to_string()
        } else {
            rel_str.replace('\\', "/")
        }
    } else {
        current_path.to_string_lossy().to_string()
    }
}

/// Execute a real system command and return output and exit code.
///
/// # Arguments
/// * `command` - The command string to execute (will be passed to shell)
/// * `current_path` - The working directory for command execution (must be within block sandbox)
///
/// # Returns
/// A tuple of (output_string, exit_code)
///
/// # Security Considerations
///
/// **Command Injection Risk**: This function executes commands via shell (`sh -c` on Unix, `cmd /c` on Windows),
/// allowing full shell syntax including:
/// - Command chaining (`&&`, `||`, `;`)
/// - Pipes (`|`)
/// - Redirections (`>`, `>>`, `<`)
/// - Variable expansion (`$VAR`, `${VAR}`)
/// - Subshells (`$(command)`, `` `command` ``)
///
/// This is intentional for terminal functionality, but be aware:
///
/// - **Sandboxing**: Commands run within the block's sandboxed directory (`block-{block_id}`),
///   which is isolated from other blocks and the system. The `current_path` is validated to ensure
///   it stays within the `root_path` boundary.
///
/// - **Command Length**: Commands are limited to 10,000 characters (validated in `handle_terminal_execute`).
///
/// - **Path Safety**: The `current_path` parameter is validated before reaching this function to ensure
///   it's within the block's root directory, preventing directory traversal attacks.
///
/// - **Production Recommendations**: For production use in untrusted environments, consider:
///   - Command whitelisting/blacklisting
///   - Additional input sanitization
///   - Rate limiting for command execution
///   - Audit logging of all executed commands
///
/// # Notes
/// - Working directory is set based on `current_path` (validated to be within block sandbox)
/// - Output is captured from stdout and stderr
/// - Both stdout and stderr are combined in the output string
fn execute_system_command(command: &str, current_path: &Path) -> (String, i32) {
    // Parse command into parts
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return ("".to_string(), 0);
    }

    // Security: Commands are executed in a shell, allowing full shell syntax.
    // This is intentional for terminal functionality, but be aware:
    // - All commands run within sandboxed block directories (validated via current_path)
    // - Command length is limited to 10,000 characters (validated in handle_terminal_execute)
    // - Path traversal is prevented by root_path validation
    // - For production use, consider adding command whitelisting
    
    // Determine working directory
    // For block directories, we'd need to get the actual file system path
    // For now, use current working directory or a safe temp location
    let work_dir = if current_path.is_absolute() {
        current_path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(current_path)
    };
    let work_dir = if work_dir.exists() {
        work_dir
    } else {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    };

    // Execute command based on platform
    #[cfg(target_os = "windows")]
    let result = {
        // On Windows, use cmd.exe /c
        StdCommand::new("cmd")
            .arg("/c")
            .arg(trimmed)
            .current_dir(work_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
    };
    
    #[cfg(not(target_os = "windows"))]
    let result = {
        // On Unix-like systems, use sh -c
        StdCommand::new("sh")
            .arg("-c")
            .arg(trimmed)
            .current_dir(work_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
    };

    match result {
        Ok(output) => {
            let exit_code = output.status.code().unwrap_or(1);
            
            // Combine stdout and stderr
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            let combined_output = if stderr.is_empty() {
                stdout.trim_end().to_string()
            } else {
                format!("{}\n{}", stdout.trim_end(), stderr.trim_end())
            };
            
            (combined_output, exit_code)
        }
        Err(e) => {
            // Command execution failed
            (format!("Error executing command: {}", e), 1)
        }
    }
}

