use crate::engine::EventStore;
use crate::models::Event;
use std::collections::HashMap;

/// Grants table for Capability-Based Access Control (CBAC).
///
/// Tracks which editors have been granted which capabilities for which blocks.
/// This table is projected from grant/revoke events in the EventStore.
#[derive(Debug, Clone)]
pub struct GrantsTable {
    /// Map: editor_id -> Vec<(cap_id, block_id)>
    grants: HashMap<String, Vec<(String, String)>>,
}

impl GrantsTable {
    /// Create an empty grants table.
    pub fn new() -> Self {
        Self {
            grants: HashMap::new(),
        }
    }

    /// Project a grants table from events in the EventStore.
    ///
    /// Processes all grant and revoke events to build the current authorization state.
    /// Events have attribute format `{editor_id}/{cap_id}` where cap_id is "core.grant" or "core.revoke".
    pub fn from_events(events: &[Event]) -> Self {
        let mut table = Self::new();

        for event in events {
            // Attribute format: "{editor_id}/{cap_id}"
            // Grant events: attribute ends with "/core.grant"
            // Revoke events: attribute ends with "/core.revoke"

            if event.attribute.ends_with("/core.grant") {
                if let Some(grant_obj) = event.value.as_object() {
                    let editor = grant_obj.get("editor")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let capability = grant_obj.get("capability")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let block = grant_obj.get("block")
                        .and_then(|v| v.as_str())
                        .unwrap_or("*");

                    if !editor.is_empty() && !capability.is_empty() {
                        table.add_grant(editor.to_string(), capability.to_string(), block.to_string());
                    }
                }
            }
            else if event.attribute.ends_with("/core.revoke") {
                if let Some(revoke_obj) = event.value.as_object() {
                    let editor = revoke_obj.get("editor")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let capability = revoke_obj.get("capability")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let block = revoke_obj.get("block")
                        .and_then(|v| v.as_str())
                        .unwrap_or("*");

                    if !editor.is_empty() && !capability.is_empty() {
                        table.remove_grant(editor, capability, block);
                    }
                }
            }
        }

        table
    }

    /// Project grants table from an EventStore.
    pub fn from_event_store(store: &EventStore) -> Result<Self, rusqlite::Error> {
        let events = store.get_all_events()?;
        Ok(Self::from_events(&events))
    }

    /// Add a grant to the table.
    pub fn add_grant(&mut self, editor_id: String, cap_id: String, block_id: String) {
        let entry = self.grants.entry(editor_id).or_default();

        // Avoid duplicates
        let grant_pair = (cap_id, block_id);
        if !entry.contains(&grant_pair) {
            entry.push(grant_pair);
        }
    }

    /// Remove a grant from the table.
    pub fn remove_grant(&mut self, editor_id: &str, cap_id: &str, block_id: &str) {
        if let Some(editor_grants) = self.grants.get_mut(editor_id) {
            editor_grants.retain(|(cap, blk)| !(cap == cap_id && blk == block_id));

            // Clean up empty entries
            if editor_grants.is_empty() {
                self.grants.remove(editor_id);
            }
        }
    }

    /// Get all grants for a specific editor.
    ///
    /// Returns a reference to the Vec of (cap_id, block_id) tuples, or None if no grants exist.
    pub fn get_grants(&self, editor_id: &str) -> Option<&Vec<(String, String)>> {
        self.grants.get(editor_id)
    }

    /// Get the internal grants map (for certificator function).
    pub fn as_map(&self) -> &HashMap<String, Vec<(String, String)>> {
        &self.grants
    }

    /// Check if an editor has a specific grant.
    pub fn has_grant(&self, editor_id: &str, cap_id: &str, block_id: &str) -> bool {
        if let Some(editor_grants) = self.grants.get(editor_id) {
            editor_grants.iter().any(|(cap, blk)| {
                cap == cap_id && (blk == block_id || blk == "*")
            })
        } else {
            false
        }
    }
}

impl Default for GrantsTable {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap as StdHashMap;

    #[test]
    fn test_add_grant() {
        let mut table = GrantsTable::new();

        table.add_grant("alice".to_string(), "markdown.write".to_string(), "block1".to_string());

        let grants = table.get_grants("alice").unwrap();
        assert_eq!(grants.len(), 1);
        assert_eq!(grants[0], ("markdown.write".to_string(), "block1".to_string()));
    }

    #[test]
    fn test_add_duplicate_grant() {
        let mut table = GrantsTable::new();

        table.add_grant("alice".to_string(), "markdown.write".to_string(), "block1".to_string());
        table.add_grant("alice".to_string(), "markdown.write".to_string(), "block1".to_string());

        let grants = table.get_grants("alice").unwrap();
        assert_eq!(grants.len(), 1, "Duplicate grants should not be added");
    }

    #[test]
    fn test_remove_grant() {
        let mut table = GrantsTable::new();

        table.add_grant("alice".to_string(), "markdown.write".to_string(), "block1".to_string());
        table.add_grant("alice".to_string(), "core.link".to_string(), "block2".to_string());

        table.remove_grant("alice", "markdown.write", "block1");

        let grants = table.get_grants("alice").unwrap();
        assert_eq!(grants.len(), 1);
        assert_eq!(grants[0], ("core.link".to_string(), "block2".to_string()));
    }

    #[test]
    fn test_has_grant_exact_match() {
        let mut table = GrantsTable::new();
        table.add_grant("alice".to_string(), "markdown.write".to_string(), "block1".to_string());

        assert!(table.has_grant("alice", "markdown.write", "block1"));
        assert!(!table.has_grant("alice", "markdown.write", "block2"));
        assert!(!table.has_grant("alice", "core.link", "block1"));
    }

    #[test]
    fn test_has_grant_wildcard() {
        let mut table = GrantsTable::new();
        table.add_grant("alice".to_string(), "markdown.write".to_string(), "*".to_string());

        assert!(table.has_grant("alice", "markdown.write", "block1"));
        assert!(table.has_grant("alice", "markdown.write", "block2"));
        assert!(table.has_grant("alice", "markdown.write", "any_block"));
    }

    #[test]
    fn test_from_events() {
        // Create mock grant events
        let mut ts1 = StdHashMap::new();
        ts1.insert("alice".to_string(), 1);

        let grant_event = Event::new(
            "alice".to_string(),
            "alice/core.grant".to_string(),  // attribute format: {editor_id}/{cap_id}
            serde_json::json!({
                "editor": "bob",
                "capability": "markdown.write",
                "block": "block1"
            }),
            ts1.clone(),
        );

        let mut ts2 = StdHashMap::new();
        ts2.insert("alice".to_string(), 2);

        let revoke_event = Event::new(
            "alice".to_string(),
            "alice/core.revoke".to_string(),  // attribute format: {editor_id}/{cap_id}
            serde_json::json!({
                "editor": "bob",
                "capability": "markdown.write",
                "block": "block1"
            }),
            ts2,
        );

        // Test: grant then revoke
        let table = GrantsTable::from_events(&[grant_event.clone()]);
        assert!(table.has_grant("bob", "markdown.write", "block1"));

        let table = GrantsTable::from_events(&[grant_event, revoke_event]);
        assert!(!table.has_grant("bob", "markdown.write", "block1"));
    }
}
