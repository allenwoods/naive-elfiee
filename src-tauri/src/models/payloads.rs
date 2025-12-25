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
    /// The source category of the block ("outline" or "linked")
    #[serde(default = "default_source")]
    pub source: String,
    /// Optional metadata (description, custom fields, etc.)
    ///
    /// If provided, will be merged with auto-generated timestamps.
    /// Example: { "description": "项目需求文档" }
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

fn default_source() -> String {
    "outline".to_string()
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

/// Payload for core.update_metadata capability
///
/// This payload is used to update metadata fields of an existing block.
/// The metadata will be merged with existing metadata (not replaced).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateMetadataPayload {
    /// Metadata fields to update or add
    /// Example: { "description": "Updated description", "tags": ["tag1", "tag2"] }
    pub metadata: serde_json::Value,
}

/// Payload for editor.create capability
///
/// This payload is used to create a new editor identity in the file.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EditorCreatePayload {
    /// The display name for the new editor
    pub name: String,
    /// The type of editor (Human or Bot), defaults to Human if not specified
    #[serde(default)]
    pub editor_type: Option<String>,
    /// Optional explicitly provided editor ID (e.g. system editor ID)
    #[serde(default)]
    pub editor_id: Option<String>,
}

/// Payload for editor.delete capability
///
/// This payload is used to delete an editor identity from the file.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EditorDeletePayload {
    /// The editor ID to delete
    pub editor_id: String,
}

/// Payload for core.rename capability
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RenamePayload {
    /// The new name for the block
    pub name: String,
}

/// Payload for core.change_type capability
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ChangeTypePayload {
    /// The new block type
    pub block_type: String,
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
            "block_type": "markdown",
            "source": "linked"
        });
        let payload: CreateBlockPayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.name, "My Block");
        assert_eq!(payload.block_type, "markdown");
        assert_eq!(payload.source, "linked");
        assert!(payload.metadata.is_none());
    }

    #[test]
    fn test_create_block_payload_default_source() {
        let json = serde_json::json!({
            "name": "My Block",
            "block_type": "markdown"
        });
        let payload: CreateBlockPayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.source, "outline");
    }

    #[test]
    fn test_create_block_payload_with_metadata() {
        let json = serde_json::json!({
            "name": "My Block",
            "block_type": "markdown",
            "metadata": {
                "description": "测试描述"
            }
        });
        let payload: CreateBlockPayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.name, "My Block");
        assert!(payload.metadata.is_some());

        let metadata = payload.metadata.unwrap();
        assert_eq!(metadata["description"], "测试描述");
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
        assert!(payload.editor_id.is_none());
    }

    #[test]
    fn test_editor_create_payload_with_id() {
        let json = serde_json::json!({
            "name": "System",
            "editor_id": "sys-123"
        });
        let payload: EditorCreatePayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.name, "System");
        assert_eq!(payload.editor_id, Some("sys-123".to_string()));
    }
}
