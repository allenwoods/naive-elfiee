/// Terminal Extension
///
/// PTY-based terminal implementation using portable-pty

use serde::{Deserialize, Serialize};
use specta::Type;

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
