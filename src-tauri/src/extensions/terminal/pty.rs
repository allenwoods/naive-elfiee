//! PTY (Pseudo-Terminal) infrastructure
//!
//! This module contains all PTY-related functionality:
//! - Session state management (TerminalState, TerminalSession)
//! - Shell initialization script generation
//! - Permission capabilities for PTY operations (init, write, resize, close)
//!
//! ## Architecture
//!
//! The PTY permission capabilities act as authorization gates for Tauri commands:
//! - `terminal.init` - Authorization for PTY initialization
//! - `terminal.write` - Authorization for PTY write
//! - `terminal.resize` - Authorization for PTY resize
//! - `terminal.close` - Authorization for PTY close
//!
//! These capabilities do NOT generate events - they only perform permission checks.
//! The actual PTY operations are handled by Tauri commands in `commands/terminal.rs`.

use crate::capabilities::core::CapResult;
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use portable_pty::MasterPty;
use std::collections::HashMap;
use std::io::Write;
use std::path::Path;
use std::sync::{Arc, Mutex};

// ============================================================================
// Session State Management
// ============================================================================

/// Represents an active terminal session with its PTY resources.
pub struct TerminalSession {
    /// Writer for sending data to the PTY
    pub writer: Box<dyn Write + Send>,
    /// Master PTY handle for resize operations
    pub master: Box<dyn MasterPty + Send>,
    /// Channel to signal the reader thread to stop
    pub shutdown_tx: std::sync::mpsc::Sender<()>,
}

/// Global state for managing all terminal sessions.
///
/// Sessions are keyed by block_id, allowing multiple terminals
/// to be active simultaneously.
pub struct TerminalState {
    /// Map of block_id -> TerminalSession
    pub sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl TerminalState {
    /// Create a new empty terminal state.
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl Default for TerminalState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Shell Initialization
// ============================================================================

/// Generate shell initialization script.
///
/// Overrides the `cd` command to intercept when the user's home directory
/// is passed (after shell expansion of `~`) and redirects to the .elf workspace.
///
/// # Arguments
/// * `work_dir` - The .elf temporary workspace directory
/// * `shell` - The shell type: "bash", "zsh", or "powershell"
///
/// # Returns
/// * `Ok(String)` - The initialization script (empty for PowerShell which uses profile)
/// * `Err(String)` - Error for unsupported shell types
pub fn generate_shell_init(work_dir: &Path, shell: &str) -> Result<String, String> {
    let work_dir_str = work_dir
        .to_str()
        .ok_or("Failed to convert work directory path to string")?;

    match shell {
        "bash" | "zsh" => Ok(format!(
            r#"clear
export ELF_WORK_DIR="{}"
cd() {{
    # Check if path equals user's home directory (shell expands ~ to $HOME)
    if [ "$1" = "$HOME" ] || [ "$1" = "~" ]; then
        builtin cd "$ELF_WORK_DIR"
    elif [ -z "$1" ]; then
        builtin cd "$HOME"
    else
        builtin cd "$@"
    fi
}}
"#,
            work_dir_str
        )),
        // PowerShell uses a separate profile script mechanism
        // The initialization is handled in commands/terminal.rs
        "powershell" => Ok(String::new()),
        _ => Err(format!("Unsupported shell: {}", shell)),
    }
}

// ============================================================================
// PTY Permission Capabilities
// ============================================================================

/// Validate that the block exists and is of type "terminal".
fn validate_terminal_block<'a>(
    block: Option<&'a Block>,
    cap_id: &str,
) -> Result<&'a Block, String> {
    let block = block.ok_or(format!("Block required for {}", cap_id))?;
    if block.block_type != "terminal" {
        return Err(format!(
            "Expected block_type 'terminal', got '{}'",
            block.block_type
        ));
    }
    Ok(block)
}

/// Handler for terminal.init capability.
///
/// Performs authorization check for terminal initialization.
/// The actual PTY creation is handled by the Tauri command.
#[capability(id = "terminal.init", target = "terminal")]
fn handle_terminal_init(_cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    validate_terminal_block(block, "terminal.init")?;
    Ok(vec![])
}

/// Handler for terminal.write capability.
///
/// Performs authorization check for writing to a terminal.
/// The actual PTY write is handled by the Tauri command.
#[capability(id = "terminal.write", target = "terminal")]
fn handle_terminal_write(_cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    validate_terminal_block(block, "terminal.write")?;
    Ok(vec![])
}

/// Handler for terminal.resize capability.
///
/// Performs authorization check for resizing a terminal.
/// The actual PTY resize is handled by the Tauri command.
#[capability(id = "terminal.resize", target = "terminal")]
fn handle_terminal_resize(_cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    validate_terminal_block(block, "terminal.resize")?;
    Ok(vec![])
}

/// Handler for terminal.close capability.
///
/// Performs authorization check for closing a terminal session.
/// The actual PTY cleanup is handled by the Tauri command.
#[capability(id = "terminal.close", target = "terminal")]
fn handle_terminal_close(_cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    validate_terminal_block(block, "terminal.close")?;
    Ok(vec![])
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // Shell initialization tests

    #[test]
    fn test_shell_bash_basic() {
        let work_dir = PathBuf::from("/tmp/test-elf-workspace");
        let script = generate_shell_init(&work_dir, "bash");
        assert!(script.is_ok(), "Should generate bash script");

        let script = script.unwrap();
        assert!(
            script.contains("export ELF_WORK_DIR="),
            "Script should export ELF_WORK_DIR"
        );
        assert!(
            script.contains("/tmp/test-elf-workspace"),
            "Script should contain the work directory path"
        );
        assert!(
            script.contains("cd()"),
            "Script should define cd function override"
        );
        assert!(
            script.contains("builtin cd"),
            "Script should use builtin cd"
        );
        assert!(script.contains("clear"), "Script should clear the screen");
    }

    #[test]
    fn test_shell_zsh_basic() {
        let work_dir = PathBuf::from("/home/user/.elf-workspace");
        let script = generate_shell_init(&work_dir, "zsh");
        assert!(script.is_ok(), "Should generate zsh script");

        let script = script.unwrap();
        assert!(script.contains("clear"));
        assert!(script.contains("export ELF_WORK_DIR="));
        assert!(script.contains("/home/user/.elf-workspace"));
        assert!(script.contains("cd()"));
    }

    #[test]
    fn test_shell_powershell_basic() {
        let work_dir = PathBuf::from("C:\\Users\\test\\.elf-workspace");
        let script = generate_shell_init(&work_dir, "powershell");
        assert!(script.is_ok(), "Should handle PowerShell");
        assert_eq!(
            script.unwrap(),
            "",
            "PowerShell should return empty string (uses profile instead)"
        );
    }

    #[test]
    fn test_shell_unsupported_error() {
        let work_dir = PathBuf::from("/tmp/test");
        let result = generate_shell_init(&work_dir, "fish");
        assert!(result.is_err(), "Should reject unsupported shell");
        assert!(result.unwrap_err().contains("Unsupported shell"));
    }

    #[test]
    fn test_shell_special_path_edge_case() {
        let work_dir = PathBuf::from("/tmp/elfiee workspace/test-123");
        let script = generate_shell_init(&work_dir, "bash");
        assert!(script.is_ok(), "Should handle paths with spaces");
        assert!(script.unwrap().contains("/tmp/elfiee workspace/test-123"));
    }

    #[test]
    fn test_shell_cd_override_basic() {
        let work_dir = PathBuf::from("/tmp/elfiee-workspace");
        let script = generate_shell_init(&work_dir, "bash").unwrap();

        assert!(
            script.contains(r#"if [ "$1" = "$HOME" ] || [ "$1" = "~" ]"#),
            "Script should check for both $HOME and ~"
        );
        assert!(
            script.contains(r#"builtin cd "$ELF_WORK_DIR""#),
            "Script should redirect to ELF_WORK_DIR"
        );
    }
}
