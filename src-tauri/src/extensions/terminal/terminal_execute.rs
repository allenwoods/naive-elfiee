use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;
use std::process::Stdio;

use super::TerminalExecutePayload;

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
/// # Payload
/// Uses `TerminalExecutePayload` with a single `command` field.
#[capability(id = "terminal.execute", target = "terminal")]
fn handle_terminal_execute(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for terminal.execute")?;

    // Deserialize strongly-typed payload
    let payload: TerminalExecutePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for terminal.execute: {}", e))?;

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
        contents
            .get("root_path")
            .and_then(|d| d.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| default_root.clone())
    } else {
        default_root.clone()
    };
    if let Ok(canonical_root) = root_path.canonicalize() {
        root_path = canonical_root;
    }
    let mut current_path = if let Some(contents) = block.contents.as_object() {
        contents
            .get("current_path")
            .and_then(|d| d.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| root_path.clone())
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

/// Execute a real system command and return output and exit code
/// 
/// Security considerations:
/// - Command is executed in a shell (sh on Unix, cmd on Windows)
/// - Working directory is set based on current_dir (if it's a valid block path)
/// - Output is captured from stdout and stderr
fn execute_system_command(command: &str, current_path: &Path) -> (String, i32) {
    // Parse command into parts
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return ("".to_string(), 0);
    }

    // Security: Basic validation
    // In production, you might want to add whitelist/blacklist of allowed commands
    // For now, we allow any command but with length limit (already checked earlier)
    
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

