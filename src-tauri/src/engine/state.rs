use crate::capabilities::grants::GrantsTable;
use crate::models::{Block, BlockMetadata, Editor, Event};
use log;
use std::collections::HashMap;

/// In-memory state projection from events.
///
/// Replays all events to build the current state of blocks, editors, and grants.
/// This is the authoritative source of truth for the engine's current state.
pub struct StateProjector {
    /// All blocks indexed by block_id
    pub blocks: HashMap<String, Block>,

    /// All editors indexed by editor_id
    pub editors: HashMap<String, Editor>,

    /// Grants table for authorization (reuses existing implementation)
    pub grants: GrantsTable,

    /// Vector clock counts for each editor (for conflict detection)
    pub editor_counts: HashMap<String, i64>,
}

impl StateProjector {
    /// Create a new empty state projector.
    pub fn new() -> Self {
        Self {
            blocks: HashMap::new(),
            editors: HashMap::new(),
            grants: GrantsTable::new(),
            editor_counts: HashMap::new(),
        }
    }

    /// Replay all events to build current state.
    ///
    /// This is called once during engine initialization to rebuild
    /// state from the event store.
    pub fn replay(&mut self, events: Vec<Event>) {
        for event in events {
            self.apply_event(&event);
        }
    }

    /// Apply a single event to state.
    ///
    /// This method updates the in-memory state based on the event type.
    pub fn apply_event(&mut self, event: &Event) {
        // Update editor transaction counts from vector clock
        for (editor_id, count) in &event.timestamp {
            let current = self.editor_counts.entry(editor_id.clone()).or_insert(0);
            *current = (*current).max(*count);
        }

        // Parse attribute format: "{editor_id}/{cap_id}"
        let parts: Vec<&str> = event.attribute.split('/').collect();
        if parts.len() != 2 {
            return; // Invalid attribute format, skip
        }
        let cap_id = parts[1];

        // Handle different event types based on capability
        match cap_id {
            // Block creation
            "core.create" => {
                // Create event should contain full block state
                if let Some(obj) = event.value.as_object() {
                    let block = Block {
                        block_id: event.entity.clone(),
                        name: obj
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        block_type: obj
                            .get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        owner: obj
                            .get("owner")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        contents: obj
                            .get("contents")
                            .cloned()
                            .unwrap_or_else(|| serde_json::json!({})),
                        children: obj
                            .get("children")
                            .and_then(|v| serde_json::from_value(v.clone()).ok())
                            .unwrap_or_default(),
                        metadata: obj
                            .get("metadata")
                            .and_then(|v| match BlockMetadata::from_json(v) {
                                Ok(parsed) => Some(parsed),
                                Err(e) => {
                                    log::warn!(
                                        "Failed to parse metadata in core.create event for block {}: {}. Using default metadata.",
                                        event.entity,
                                        e
                                    );
                                    None
                                }
                            })
                            .unwrap_or_default(),
                    };
                    self.blocks.insert(block.block_id.clone(), block);
                }
            }

            // Block updates (write, link, unlink)
            _ if cap_id.ends_with(".write") || cap_id.ends_with(".link") => {
                if let Some(block) = self.blocks.get_mut(&event.entity) {
                    // Update contents if present
                    if let Some(contents) = event.value.get("contents") {
                        if let Some(obj) = block.contents.as_object_mut() {
                            if let Some(new_contents) = contents.as_object() {
                                for (k, v) in new_contents {
                                    obj.insert(k.clone(), v.clone());
                                }
                            }
                        }
                    }
                    // Update children if present
                    if let Some(children) = event.value.get("children") {
                        if let Ok(new_children) = serde_json::from_value(children.clone()) {
                            block.children = new_children;
                        }
                    }
                    // Update metadata if present (e.g. updated_at from write ops)
                    if let Some(new_metadata) = event.value.get("metadata") {
                        match BlockMetadata::from_json(new_metadata) {
                            Ok(parsed) => {
                                block.metadata = parsed;
                            }
                            Err(e) => {
                                log::warn!(
                                    "Failed to parse metadata in {} event for block {}: {}",
                                    cap_id,
                                    event.entity,
                                    e
                                );
                            }
                        }
                    }
                }
            }

            "core.unlink" => {
                if let Some(block) = self.blocks.get_mut(&event.entity) {
                    // Update children
                    if let Some(children) = event.value.get("children") {
                        if let Ok(new_children) = serde_json::from_value(children.clone()) {
                            block.children = new_children;
                        }
                    }
                }
            }

            // Block deletion
            "core.delete" => {
                self.blocks.remove(&event.entity);
            }

            // Block metadata update
            "core.update_metadata" => {
                if let Some(block) = self.blocks.get_mut(&event.entity) {
                    // Update metadata by merging with existing
                    if let Some(new_metadata) = event.value.get("metadata") {
                        match BlockMetadata::from_json(new_metadata) {
                            Ok(parsed) => {
                                block.metadata = parsed;
                            }
                            Err(e) => {
                                log::warn!(
                                    "Failed to parse metadata for block {}: {}. Metadata value: {}",
                                    event.entity,
                                    e,
                                    new_metadata
                                );
                            }
                        }
                    }
                }
            }

            // Grant/Revoke - delegate to GrantsTable
            "core.grant" | "core.revoke" => {
                // GrantsTable already handles these in from_events
                // We need to update the grants table
                let events_slice = std::slice::from_ref(event);
                let updated_grants = GrantsTable::from_events(events_slice);
                // Merge the grants
                for (editor_id, grants) in updated_grants.as_map() {
                    for (cap_id, block_id) in grants {
                        if event.attribute.ends_with("/core.grant") {
                            self.grants.add_grant(
                                editor_id.clone(),
                                cap_id.clone(),
                                block_id.clone(),
                            );
                        } else {
                            self.grants.remove_grant(editor_id, cap_id, block_id);
                        }
                    }
                }
            }

            // Editor creation (future extension)
            "editor.create" => {
                if let Ok(editor) = serde_json::from_value::<Editor>(event.value.clone()) {
                    self.editors.insert(editor.editor_id.clone(), editor);
                }
            }

            _ => {
                // Unknown capability - ignore for now
            }
        }
    }

    /// Get a block by ID.
    pub fn get_block(&self, block_id: &str) -> Option<&Block> {
        self.blocks.get(block_id)
    }

    /// Get the current transaction count for an editor.
    pub fn get_editor_count(&self, editor_id: &str) -> i64 {
        *self.editor_counts.get(editor_id).unwrap_or(&0)
    }

    /// Check for conflicts using vector clocks (MVP simple version).
    ///
    /// Returns true if the command is based on stale state.
    /// For MVP, we only check the command editor's count.
    pub fn has_conflict(&self, editor_id: &str, expected_count: i64) -> bool {
        let current_count = self.get_editor_count(editor_id);
        expected_count < current_count
    }
}

impl Default for StateProjector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap as StdHashMap;

    #[test]
    fn test_state_projector_create_block() {
        let mut state = StateProjector::new();

        let mut ts = StdHashMap::new();
        ts.insert("alice".to_string(), 1);

        let event = Event::new(
            "block1".to_string(),
            "alice/core.create".to_string(),
            serde_json::json!({
                "name": "Test Block",
                "type": "markdown",
                "owner": "alice",
                "contents": {},
                "children": {}
            }),
            ts,
        );

        state.apply_event(&event);

        assert_eq!(state.blocks.len(), 1);
        let block = state.get_block("block1").unwrap();
        assert_eq!(block.name, "Test Block");
        assert_eq!(block.block_type, "markdown");
        assert_eq!(block.owner, "alice");
    }

    #[test]
    fn test_state_projector_delete_block() {
        let mut state = StateProjector::new();

        // Create block
        let mut ts1 = StdHashMap::new();
        ts1.insert("alice".to_string(), 1);

        let create_event = Event::new(
            "block1".to_string(),
            "alice/core.create".to_string(),
            serde_json::json!({
                "name": "Test Block",
                "type": "markdown",
                "owner": "alice",
                "contents": {},
                "children": {}
            }),
            ts1,
        );

        state.apply_event(&create_event);
        assert_eq!(state.blocks.len(), 1);

        // Delete block
        let mut ts2 = StdHashMap::new();
        ts2.insert("alice".to_string(), 2);

        let delete_event = Event::new(
            "block1".to_string(),
            "alice/core.delete".to_string(),
            serde_json::json!({ "deleted": true }),
            ts2,
        );

        state.apply_event(&delete_event);
        assert_eq!(state.blocks.len(), 0);
    }

    #[test]
    fn test_state_projector_editor_count() {
        let mut state = StateProjector::new();

        let mut ts = StdHashMap::new();
        ts.insert("alice".to_string(), 5);
        ts.insert("bob".to_string(), 3);

        let event = Event::new(
            "block1".to_string(),
            "alice/core.create".to_string(),
            serde_json::json!({
                "name": "Test",
                "type": "markdown",
                "owner": "alice",
                "contents": {},
                "children": {}
            }),
            ts,
        );

        state.apply_event(&event);

        assert_eq!(state.get_editor_count("alice"), 5);
        assert_eq!(state.get_editor_count("bob"), 3);
        assert_eq!(state.get_editor_count("charlie"), 0);
    }

    #[test]
    fn test_conflict_detection() {
        let mut state = StateProjector::new();

        let mut ts = StdHashMap::new();
        ts.insert("alice".to_string(), 5);

        let event = Event::new(
            "block1".to_string(),
            "alice/core.create".to_string(),
            serde_json::json!({
                "name": "Test",
                "type": "markdown",
                "owner": "alice",
                "contents": {},
                "children": {}
            }),
            ts,
        );

        state.apply_event(&event);

        // Command based on count 5 is ok (current state)
        assert!(!state.has_conflict("alice", 5));

        // Command based on count 4 is a conflict (stale)
        assert!(state.has_conflict("alice", 4));

        // Command based on count 6 is ok (newer)
        assert!(!state.has_conflict("alice", 6));
    }

    #[test]
    fn test_apply_create_event_with_metadata() {
        let mut state = StateProjector::new();

        let event = Event::new(
            "block1".to_string(),
            "alice/core.create".to_string(),
            serde_json::json!({
                "name": "Test Block",
                "type": "markdown",
                "owner": "alice",
                "contents": {},
                "children": {},
                "metadata": {
                    "description": "测试描述",
                    "created_at": "2025-12-17T02:30:00Z",
                    "updated_at": "2025-12-17T02:30:00Z"
                }
            }),
            {
                let mut ts = std::collections::HashMap::new();
                ts.insert("alice".to_string(), 1);
                ts
            },
        );

        state.apply_event(&event);

        assert_eq!(state.blocks.len(), 1);
        let block = state.get_block("block1").unwrap();
        assert_eq!(block.name, "Test Block");

        // Verify metadata
        assert_eq!(block.metadata.description, Some("测试描述".to_string()));
        assert_eq!(
            block.metadata.created_at,
            Some("2025-12-17T02:30:00Z".to_string())
        );
        assert_eq!(
            block.metadata.updated_at,
            Some("2025-12-17T02:30:00Z".to_string())
        );
    }

    #[test]
    fn test_apply_write_event_updates_metadata() {
        let mut state = StateProjector::new();

        // 先创建 Block
        let create_event = Event::new(
            "block1".to_string(),
            "alice/core.create".to_string(),
            serde_json::json!({
                "name": "Test",
                "type": "markdown",
                "owner": "alice",
                "contents": {},
                "children": {},
                "metadata": {
                    "created_at": "2025-12-17T02:30:00Z",
                    "updated_at": "2025-12-17T02:30:00Z"
                }
            }),
            {
                let mut ts = std::collections::HashMap::new();
                ts.insert("alice".to_string(), 1);
                ts
            },
        );
        state.apply_event(&create_event);

        // 写入内容（模拟更新了 updated_at）
        let write_event = Event::new(
            "block1".to_string(),
            "alice/markdown.write".to_string(),
            serde_json::json!({
                "contents": {
                    "markdown": "# Hello"
                },
                "metadata": {
                    "created_at": "2025-12-17T02:30:00Z",
                    "updated_at": "2025-12-17T10:15:00Z"
                }
            }),
            {
                let mut ts = std::collections::HashMap::new();
                ts.insert("alice".to_string(), 2);
                ts
            },
        );
        state.apply_event(&write_event);

        let block = state.get_block("block1").unwrap();

        // Contents should be updated
        assert_eq!(block.contents["markdown"], "# Hello");

        // Metadata should be updated
        assert_eq!(
            block.metadata.created_at,
            Some("2025-12-17T02:30:00Z".to_string())
        );
        assert_eq!(
            block.metadata.updated_at,
            Some("2025-12-17T10:15:00Z".to_string())
        );
    }

    #[test]
    fn test_replay_maintains_metadata() {
        let mut state = StateProjector::new();

        let events = vec![
            Event::new(
                "block1".to_string(),
                "alice/core.create".to_string(),
                serde_json::json!({
                    "name": "Block 1",
                    "type": "markdown",
                    "owner": "alice",
                    "contents": {},
                    "children": {},
                    "metadata": {
                        "description": "描述1",
                        "created_at": "2025-12-17T02:00:00Z",
                        "updated_at": "2025-12-17T02:00:00Z"
                    }
                }),
                {
                    let mut ts = std::collections::HashMap::new();
                    ts.insert("alice".to_string(), 1);
                    ts
                },
            ),
            Event::new(
                "block1".to_string(),
                "alice/markdown.write".to_string(),
                serde_json::json!({
                    "contents": { "markdown": "内容" },
                    "metadata": {
                        "description": "描述1",
                        "created_at": "2025-12-17T02:00:00Z",
                        "updated_at": "2025-12-17T03:00:00Z"
                    }
                }),
                {
                    let mut ts = std::collections::HashMap::new();
                    ts.insert("alice".to_string(), 2);
                    ts
                },
            ),
        ];

        state.replay(events);

        let block = state.get_block("block1").unwrap();
        assert_eq!(block.metadata.description, Some("描述1".to_string()));
        assert_eq!(
            block.metadata.created_at,
            Some("2025-12-17T02:00:00Z".to_string())
        );
        assert_eq!(
            block.metadata.updated_at,
            Some("2025-12-17T03:00:00Z".to_string())
        );
    }
}
