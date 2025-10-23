use crate::models::{Block, Command, Event};
use std::collections::HashMap;

/// Result type for capability execution
pub type CapResult<T> = Result<T, String>;

/// Core trait for capability handlers.
///
/// All capabilities must implement this trait. Use the `#[capability]` macro
/// to avoid boilerplate code.
pub trait CapabilityHandler: Send + Sync {
    /// Unique capability ID (e.g., "core.link", "markdown.write")
    fn cap_id(&self) -> &str;

    /// Target block type pattern (e.g., "core/*", "markdown")
    fn target(&self) -> &str;

    /// Check if an editor is authorized to execute this capability.
    ///
    /// Default implementation:
    /// - Block owner always has access
    /// - Otherwise, check the grants HashMap
    fn certificator(
        &self,
        editor_id: &str,
        block: &Block,
        grants: &HashMap<String, Vec<(String, String)>>, // editor_id -> [(cap_id, block_id)]
    ) -> bool {
        // Owner check: block owner has all capabilities
        if block.owner == editor_id {
            return true;
        }

        // Check grants
        if let Some(editor_grants) = grants.get(editor_id) {
            editor_grants.iter().any(|(cap, blk)| {
                cap == self.cap_id() && (blk == &block.block_id || blk == "*")
            })
        } else {
            false
        }
    }

    /// Execute the capability and return events to be appended.
    ///
    /// This method contains the actual logic of the capability.
    fn handler(&self, cmd: &Command, block: &Block) -> CapResult<Vec<Event>>;
}

/// Helper function to create a standard Event with vector clock.
///
/// This simplifies event creation in capability handlers.
pub fn create_event(
    entity: String,
    attribute: String,
    value: serde_json::Value,
    editor_id: &str,
    editor_count: u64,
) -> Event {
    let mut timestamp = HashMap::new();
    timestamp.insert(editor_id.to_string(), editor_count);

    Event::new(entity, attribute, value, timestamp)
}
