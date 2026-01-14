/// Terminal Extension
///
/// PTY-based terminal implementation using portable-pty
///
/// ## Capabilities
///
/// - `terminal.save`: Save terminal content (buffer snapshot) to a terminal block
///
/// ## Payload Types
///
/// - `TerminalSavePayload`: Payload for saving terminal content
/// - `TerminalInitPayload`: Payload for initializing PTY session
/// - `TerminalWritePayload`: Payload for writing data to PTY
/// - `TerminalResizePayload`: Payload for resizing PTY window
use serde::{Deserialize, Serialize};
use specta::Type;

/// Payload for terminal.init Tauri command
///
/// This payload is used to initialize a PTY session for a terminal block.
#[derive(Debug, Clone, Deserialize, Serialize, Type)]
pub struct TerminalInitPayload {
    pub cols: u16,
    pub rows: u16,
    pub block_id: String,
    pub editor_id: String,
    pub file_id: String,     // Required for permission checking
    pub cwd: Option<String>, // Optional working directory
}

/// Payload for terminal.write Tauri command
///
/// This payload is used to write user input data to the PTY.
#[derive(Debug, Clone, Deserialize, Serialize, Type)]
pub struct TerminalWritePayload {
    pub data: String,
    pub block_id: String,
    pub file_id: String,   // Required for permission checking
    pub editor_id: String, // Required for permission checking
}

/// Payload for terminal.resize Tauri command
///
/// This payload is used to resize the PTY window.
#[derive(Debug, Clone, Deserialize, Serialize, Type)]
pub struct TerminalResizePayload {
    pub cols: u16,
    pub rows: u16,
    pub block_id: String,
    pub file_id: String,   // Required for permission checking
    pub editor_id: String, // Required for permission checking
}

/// Payload for terminal.save capability
///
/// This payload is used to save terminal content (buffer snapshot) to a terminal block.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TerminalSavePayload {
    /// The terminal content to save (typically from xterm.js buffer)
    pub saved_content: String,
    /// Timestamp when the content was saved
    pub saved_at: String,
}

pub mod pty;
pub mod terminal_save;

pub use pty::*;
pub use terminal_save::*;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod pty_tests;
