use serde::{Deserialize, Serialize};
use specta::Type;

// NOTE: Extension-specific payloads should be defined in their respective extension modules.
// This file contains only CORE capability payloads that are part of the base system.

/// Payload for core.create capability
///
/// This payload is used to create a new block with a name and type.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CreateBlockPayload {
    /// The display name for the new block
    pub name: String,
    /// The block type (e.g., "markdown", "code", "diagram")
    pub block_type: String,
}

/// Payload for core.link capability
///
/// This payload is used to create a link (relation) from one block to another.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct LinkBlockPayload {
    /// The relation type (e.g., "references", "depends_on", "contains")
    pub relation: String,
    /// The target block ID to link to
    pub target_id: String,
}

/// Payload for core.unlink capability
///
/// This payload is used to remove a link (relation) from one block to another.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UnlinkBlockPayload {
    /// The relation type (e.g., "references", "depends_on", "contains")
    pub relation: String,
    /// The target block ID to unlink
    pub target_id: String,
}

/// Payload for core.grant capability
///
/// This payload is used to grant a capability to an editor for a specific block.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct GrantPayload {
    /// The editor ID to grant the capability to
    pub target_editor: String,
    /// The capability ID to grant (e.g., "markdown.write", "core.delete")
    pub capability: String,
    /// The block ID to grant access to, or "*" for all blocks (wildcard)
    #[serde(default = "default_wildcard")]
    pub target_block: String,
}

/// Payload for core.revoke capability
///
/// This payload is used to revoke a capability from an editor for a specific block.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RevokePayload {
    /// The editor ID to revoke the capability from
    pub target_editor: String,
    /// The capability ID to revoke
    pub capability: String,
    /// The block ID to revoke access from, or "*" for all blocks (wildcard)
    #[serde(default = "default_wildcard")]
    pub target_block: String,
}

/// Payload for editor.create capability
///
/// This payload is used to create a new editor identity in the file.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EditorCreatePayload {
    /// The display name for the new editor
    pub name: String,
}

/// Default value for target_block field (wildcard)
fn default_wildcard() -> String {
    "*".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_block_payload() {
        let json = serde_json::json!({
            "name": "My Block",
            "block_type": "markdown"
        });
        let payload: CreateBlockPayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.name, "My Block");
        assert_eq!(payload.block_type, "markdown");
    }

    #[test]
    fn test_link_block_payload() {
        let json = serde_json::json!({
            "relation": "references",
            "target_id": "block-456"
        });
        let payload: LinkBlockPayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.relation, "references");
        assert_eq!(payload.target_id, "block-456");
    }

    #[test]
    fn test_unlink_block_payload() {
        let json = serde_json::json!({
            "relation": "depends_on",
            "target_id": "block-789"
        });
        let payload: UnlinkBlockPayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.relation, "depends_on");
        assert_eq!(payload.target_id, "block-789");
    }

    #[test]
    fn test_grant_payload_with_wildcard_default() {
        let json = serde_json::json!({
            "target_editor": "alice",
            "capability": "markdown.write"
        });
        let payload: GrantPayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.target_editor, "alice");
        assert_eq!(payload.capability, "markdown.write");
        assert_eq!(payload.target_block, "*");
    }

    #[test]
    fn test_grant_payload_with_specific_block() {
        let json = serde_json::json!({
            "target_editor": "bob",
            "capability": "core.delete",
            "target_block": "block-123"
        });
        let payload: GrantPayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.target_block, "block-123");
    }

    #[test]
    fn test_revoke_payload() {
        let json = serde_json::json!({
            "target_editor": "charlie",
            "capability": "markdown.write",
            "target_block": "block-999"
        });
        let payload: RevokePayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.target_editor, "charlie");
        assert_eq!(payload.capability, "markdown.write");
        assert_eq!(payload.target_block, "block-999");
    }

    #[test]
    fn test_editor_create_payload() {
        let json = serde_json::json!({
            "name": "Alice"
        });
        let payload: EditorCreatePayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.name, "Alice");
    }
}
