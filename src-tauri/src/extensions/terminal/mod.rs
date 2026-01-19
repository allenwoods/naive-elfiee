//! Terminal Extension
//!
//! PTY-based terminal implementation using portable-pty.
//!
//! ## Architecture
//!
//! The terminal extension follows Elfiee's split architecture:
//!
//! ### PTY Infrastructure (pty.rs)
//! - Session state management (TerminalState, TerminalSession)
//! - Shell initialization scripts
//! - Permission capabilities (terminal.init, terminal.write, terminal.resize, terminal.close)
//!
//! ### Business Capability (terminal_save.rs)
//! - `terminal.save` - Save terminal content to block (event-sourced, frontend callable)
//!
//! ### Tauri Commands (commands/terminal.rs)
//! Actual PTY operations that call Capabilities for authorization:
//! - `async_init_terminal` - Initialize PTY session
//! - `write_to_pty` - Write user input to PTY
//! - `resize_pty` - Resize PTY window
//! - `close_terminal_session` - Close PTY session
//!
//! ## Payload Types
//!
//! - `TerminalInitPayload` - Parameters for PTY initialization
//! - `TerminalWritePayload` - Parameters for PTY write
//! - `TerminalResizePayload` - Parameters for PTY resize
//! - `TerminalSavePayload` - Parameters for content save

use serde::{Deserialize, Serialize};
use specta::Type;

// ============================================================================
// Module Exports
// ============================================================================

pub mod pty;
pub mod terminal_save;

// Re-export PTY infrastructure
pub use pty::{generate_shell_init, TerminalSession, TerminalState};

// Re-export PTY permission capabilities
pub use pty::{
    TerminalCloseCapability, TerminalInitCapability, TerminalResizeCapability,
    TerminalWriteCapability,
};

// Re-export terminal.save capability
pub use terminal_save::*;

// ============================================================================
// Payload Definitions
// ============================================================================

/// Payload for terminal.init Tauri command
///
/// This payload is used to initialize a PTY session for a terminal block.
#[derive(Debug, Clone, Deserialize, Serialize, Type)]
pub struct TerminalInitPayload {
    /// Number of columns in the terminal
    pub cols: u16,
    /// Number of rows in the terminal
    pub rows: u16,
    /// The terminal block ID
    pub block_id: String,
    /// The editor initiating the session
    pub editor_id: String,
    /// The file containing the terminal block (required for permission checking)
    pub file_id: String,
    /// Optional initial working directory
    pub cwd: Option<String>,
}

/// Payload for terminal.write Tauri command
///
/// This payload is used to write user input data to the PTY.
#[derive(Debug, Clone, Deserialize, Serialize, Type)]
pub struct TerminalWritePayload {
    /// The data to write (user input)
    pub data: String,
    /// The terminal block ID
    pub block_id: String,
    /// The file containing the terminal block (required for permission checking)
    pub file_id: String,
    /// The editor writing data (required for permission checking)
    pub editor_id: String,
}

/// Payload for terminal.resize Tauri command
///
/// This payload is used to resize the PTY window.
#[derive(Debug, Clone, Deserialize, Serialize, Type)]
pub struct TerminalResizePayload {
    /// New number of columns
    pub cols: u16,
    /// New number of rows
    pub rows: u16,
    /// The terminal block ID
    pub block_id: String,
    /// The file containing the terminal block (required for permission checking)
    pub file_id: String,
    /// The editor resizing (required for permission checking)
    pub editor_id: String,
}

/// Payload for terminal.save capability
///
/// This payload is used to save terminal content (buffer snapshot) to a terminal block.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TerminalSavePayload {
    /// The terminal content to save (typically from xterm.js buffer)
    pub saved_content: String,
    /// Timestamp when the content was saved (ISO 8601 format)
    pub saved_at: String,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests;
