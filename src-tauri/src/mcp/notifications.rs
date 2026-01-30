//! MCP Notification Events
//!
//! Defines the `StateChangeEvent` broadcast from the Engine after a command is committed.
//! The MCP notification dispatcher listens for these events and notifies connected
//! MCP peers about resource changes.

use crate::models::Event;

/// Event broadcast from the engine after a command is committed.
///
/// This is sent over a `tokio::sync::broadcast` channel so that multiple
/// MCP dispatchers (SSE, stdio) can receive the same notification.
#[derive(Debug, Clone)]
pub struct StateChangeEvent {
    /// The file_id of the .elf file that changed
    pub file_id: String,
    /// The events that were committed
    pub events: Vec<Event>,
}
