//! Terminal session state management
//!
//! Manages PTY sessions and their lifecycle.

use portable_pty::MasterPty;
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};

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
