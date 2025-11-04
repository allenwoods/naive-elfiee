use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
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
/// - `ls`: Handled specially to list files in block directories
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

    // Get current directory for pwd command
    let current_dir = if let Some(contents) = block.contents.as_object() {
        contents
            .get("current_directory")
            .and_then(|d| d.as_str())
            .unwrap_or("block-root")
    } else {
        "block-root"
    };

    // Execute command - handle special cases first
    let (output, exit_code) = if payload.command.starts_with("__INTERNAL_LS__ ") {
        // Extract output from internal ls command (sent from frontend)
        let output = payload.command.strip_prefix("__INTERNAL_LS__ ")
            .unwrap_or("")
            .trim()
            .to_string();
        (output, 0)
    } else if payload.command.trim() == "cd" || payload.command.trim().starts_with("cd ") {
        // cd command is handled separately (changes directory in block contents)
        ("".to_string(), 0)
    } else if payload.command.trim() == "pwd" {
        // pwd returns current directory
        (current_dir.to_string(), 0)
    } else {
        // Execute real system command
        execute_system_command(&payload.command, &current_dir)
    };

    // Create new history entry
    let history_entry = serde_json::json!({
        "command": payload.command,
        "output": output,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "exit_code": exit_code
    });

    // Append to history
    history.push(history_entry);

    // Handle cd command to change directory
    let mut current_directory = if let Some(contents) = block.contents.as_object() {
        contents
            .get("current_directory")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default()
    } else {
        String::new()
    };

    // Parse cd command with security validation
    // Handle both "cd .." and "cd.." (without space)
    let trimmed_cmd = payload.command.trim();
    
    // Normalize "cd.." to "cd .." for easier parsing
    let normalized_cmd = if trimmed_cmd.starts_with("cd") && trimmed_cmd.len() > 2 {
        let after_cd = &trimmed_cmd[2..];
        if after_cd.starts_with("..") && !after_cd.starts_with(".. ") {
            format!("cd ..{}", &after_cd[2..])
        } else if after_cd.starts_with(".") && after_cd.len() == 1 {
            "cd .".to_string()
        } else if !after_cd.starts_with(" ") {
            // No space after cd, treat as "cd {rest}"
            format!("cd {}", after_cd)
        } else {
            trimmed_cmd.to_string()
        }
    } else {
        trimmed_cmd.to_string()
    };
    
    let command_parts: Vec<&str> = normalized_cmd.split_whitespace().collect();
    
    if command_parts.len() >= 2 && command_parts[0] == "cd" {
        let target_dir = command_parts[1];
        
        // Security: Validate and sanitize directory path
        // Only allow block-{uuid} format or block-root
        let new_dir = if target_dir == ".." || target_dir == "../" {
            // Go to parent directory (simplified: just go to root)
            "block-root".to_string()
        } else if target_dir == "block-root" || target_dir == "/" {
            "block-root".to_string()
        } else if target_dir.starts_with("block-") {
            // Validate block path format (block-{uuid})
            let uuid_part = &target_dir[6..]; // "block-".len() = 6
            
            // Security: Prevent path traversal and validate format
            if uuid_part.contains("/") || uuid_part.contains("..") || uuid_part.len() > 100 {
                // Invalid path, keep current directory
                return Err(format!(
                    "Invalid directory path: '{}'. Only block-{{uuid}} format or 'block-root' is allowed.",
                    target_dir
                ));
            }
            target_dir.to_string()
        } else {
            // Relative path: treat as block-{target}
            // Security: Validate that target doesn't contain dangerous characters
            if target_dir.contains("/") || target_dir.contains("..") || target_dir.len() > 100 {
                return Err(format!(
                    "Invalid directory name: '{}'. Block IDs must not contain '/' or '..'.",
                    target_dir
                ));
            }
            format!("block-{}", target_dir)
        };
        
        current_directory = new_dir;
    }

    // Preserve existing contents and update history and current_directory
    let mut new_contents = if let Some(obj) = block.contents.as_object() {
        obj.clone()
    } else {
        serde_json::Map::new()
    };
    new_contents.insert("history".to_string(), serde_json::json!(history));
    
    // Save current_directory if it was updated via cd command, or if it doesn't exist (use block-root as default)
    if command_parts.len() >= 2 && command_parts[0] == "cd" {
        // Directory was changed via cd command
        new_contents.insert("current_directory".to_string(), serde_json::json!(current_directory));
    } else if !new_contents.contains_key("current_directory") {
        // Set default directory if it doesn't exist
        new_contents.insert("current_directory".to_string(), serde_json::json!("block-root"));
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


/// Execute a real system command and return output and exit code
/// 
/// Security considerations:
/// - Command is executed in a shell (sh on Unix, cmd on Windows)
/// - Working directory is set based on current_dir (if it's a valid block path)
/// - Output is captured from stdout and stderr
fn execute_system_command(command: &str, current_dir: &str) -> (String, i32) {
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
    let work_dir = if current_dir.starts_with("block-") {
        // TODO: Convert block-{uuid} to actual file system path via AppState
        // For now, use current directory
        std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
    } else {
        std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
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

