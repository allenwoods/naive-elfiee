use super::core::CapabilityHandler;
use std::collections::HashMap;
use std::sync::Arc;

/// Registry for managing capability handlers.
///
/// Capabilities are registered at initialization and can be looked up by ID.
pub struct CapabilityRegistry {
    handlers: HashMap<String, Arc<dyn CapabilityHandler>>,
}

impl CapabilityRegistry {
    /// Create a new registry with all built-in capabilities registered.
    pub fn new() -> Self {
        let mut registry = Self {
            handlers: HashMap::new(),
        };

        // Register built-in capabilities
        registry.register_builtins();

        registry
    }

    /// Register a capability handler.
    pub fn register(&mut self, handler: Arc<dyn CapabilityHandler>) {
        self.handlers.insert(handler.cap_id().to_string(), handler);
    }

    /// Get a capability handler by ID.
    pub fn get(&self, cap_id: &str) -> Option<Arc<dyn CapabilityHandler>> {
        self.handlers.get(cap_id).cloned()
    }

    /// Register all built-in capabilities.
    fn register_builtins(&mut self) {
        use super::builtins::*;

        self.register(Arc::new(CoreCreateCapability));
        self.register(Arc::new(CoreLinkCapability));
        self.register(Arc::new(CoreUnlinkCapability));
        self.register(Arc::new(CoreDeleteCapability));
        self.register(Arc::new(CoreGrantCapability));
        self.register(Arc::new(CoreRevokeCapability));
    }
}

impl Default for CapabilityRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_initialization() {
        let registry = CapabilityRegistry::new();

        // Verify 6 core capabilities are registered
        assert!(registry.get("core.create").is_some(), "core.create should be registered");
        assert!(registry.get("core.link").is_some(), "core.link should be registered");
        assert!(registry.get("core.unlink").is_some(), "core.unlink should be registered");
        assert!(registry.get("core.delete").is_some(), "core.delete should be registered");
        assert!(registry.get("core.grant").is_some(), "core.grant should be registered");
        assert!(registry.get("core.revoke").is_some(), "core.revoke should be registered");
    }

    #[test]
    fn test_capability_lookup() {
        let registry = CapabilityRegistry::new();

        let cap = registry.get("core.link").unwrap();
        assert_eq!(cap.cap_id(), "core.link");
        assert_eq!(cap.target(), "core/*");
    }

    #[test]
    fn test_nonexistent_capability() {
        let registry = CapabilityRegistry::new();
        assert!(registry.get("nonexistent.capability").is_none());
    }

    #[test]
    fn test_link_capability_execution() {
        use crate::models::{Block, Command};

        let registry = CapabilityRegistry::new();
        let cap = registry.get("core.link").unwrap();

        let block = Block::new(
            "test".to_string(),
            "markdown".to_string(),
            "editor1".to_string(),
        );
        let cmd = Command::new(
            "editor1".to_string(),
            "core.link".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "relation": "references",
                "target_id": "block2"
            }),
        );

        let events = cap.handler(&cmd, &block).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].entity, block.block_id);
        assert_eq!(events[0].attribute, "children");
    }

    #[test]
    fn test_create_capability_execution() {
        use crate::models::{Block, Command};

        let registry = CapabilityRegistry::new();
        let cap = registry.get("core.create").unwrap();

        let dummy_block = Block::new(
            "dummy".to_string(),
            "dummy".to_string(),
            "editor1".to_string(),
        );
        let cmd = Command::new(
            "editor1".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "New Block",
                "block_type": "markdown"
            }),
        );

        let events = cap.handler(&cmd, &dummy_block).unwrap();
        assert_eq!(events.len(), 3); // name, type, owner
        assert_eq!(events[0].attribute, "name");
        assert_eq!(events[1].attribute, "type");
        assert_eq!(events[2].attribute, "owner");
    }

    #[test]
    fn test_grant_capability_execution() {
        use crate::models::{Block, Command};

        let registry = CapabilityRegistry::new();
        let cap = registry.get("core.grant").unwrap();

        let block = Block::new(
            "test".to_string(),
            "markdown".to_string(),
            "editor1".to_string(),
        );
        let cmd = Command::new(
            "editor1".to_string(),
            "core.grant".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "target_editor": "editor2",
                "capability": "markdown.write",
                "target_block": block.block_id
            }),
        );

        let events = cap.handler(&cmd, &block).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].attribute, "grant");
    }

    #[test]
    fn test_unlink_capability_execution() {
        use crate::models::{Block, Command};
        use std::collections::HashMap;

        let registry = CapabilityRegistry::new();
        let cap = registry.get("core.unlink").unwrap();

        // Create block with existing children
        let mut block = Block::new(
            "test".to_string(),
            "markdown".to_string(),
            "editor1".to_string(),
        );
        let mut children = HashMap::new();
        children.insert("references".to_string(), vec!["block2".to_string(), "block3".to_string()]);
        block.children = children;

        let cmd = Command::new(
            "editor1".to_string(),
            "core.unlink".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "relation": "references",
                "target_id": "block2"
            }),
        );

        let events = cap.handler(&cmd, &block).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].entity, block.block_id);

        // Verify block3 still exists, block2 was removed
        let new_children: HashMap<String, Vec<String>> =
            serde_json::from_value(events[0].value.clone()).unwrap();
        assert_eq!(new_children.get("references").unwrap().len(), 1);
        assert_eq!(new_children.get("references").unwrap()[0], "block3");
    }

    #[test]
    fn test_revoke_capability_execution() {
        use crate::models::{Block, Command};

        let registry = CapabilityRegistry::new();
        let cap = registry.get("core.revoke").unwrap();

        let block = Block::new(
            "test".to_string(),
            "markdown".to_string(),
            "editor1".to_string(),
        );
        let cmd = Command::new(
            "editor1".to_string(),
            "core.revoke".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "target_editor": "editor2",
                "capability": "markdown.write",
                "target_block": block.block_id
            }),
        );

        let events = cap.handler(&cmd, &block).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].attribute, "revoke");
    }
}
