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

        // Register extension capabilities
        registry.register_extensions();

        registry
    }

    /// Backwards-compatible helper used by older tests.
    pub fn with_extensions() -> Self {
        Self::new()
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
        self.register(Arc::new(CoreUpdate_metadataCapability));
        self.register(Arc::new(CoreRenameCapability));
        self.register(Arc::new(CoreChange_typeCapability));
        self.register(Arc::new(EditorCreateCapability));
        self.register(Arc::new(EditorDeleteCapability));
    }

    /// Register all extension capabilities.
    fn register_extensions(&mut self) {
        use crate::extensions::code::*;
        use crate::extensions::directory::*;
        use crate::extensions::markdown::*;
        use crate::extensions::terminal::*;

        // Markdown extension
        self.register(Arc::new(MarkdownWriteCapability));
        self.register(Arc::new(MarkdownReadCapability));

        // Terminal extension
        self.register(Arc::new(TerminalSaveCapability));

        // Directory extension
        self.register(Arc::new(DirectoryImportCapability));
        self.register(Arc::new(DirectoryExportCapability));
        self.register(Arc::new(DirectoryWriteCapability));
        self.register(Arc::new(DirectoryCreateCapability));
        self.register(Arc::new(DirectoryDeleteCapability));
        self.register(Arc::new(DirectoryRenameCapability));

        // Code extension
        self.register(Arc::new(CodeReadCapability));
        self.register(Arc::new(CodeWriteCapability));
    }
}

impl Default for CapabilityRegistry {
    fn default() -> Self {
        Self::new()
    }
}
