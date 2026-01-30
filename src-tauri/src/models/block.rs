use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

use super::BlockMetadata;

/// 唯一允许的 relation type，表示"上游定义/决定下游"的因果关系。
///
/// `Block.children` 的 key 仅允许使用此常量值。
/// 语义：`A.children["implement"] = [B]` 表示 A 的改动导致 B 需要改动。
/// 例如：Task → Code, PRD → Task → Test
pub const RELATION_IMPLEMENT: &str = "implement";

/// Block 是 Elfiee 的基本内容单元。
///
/// `children` 字段存储逻辑因果关系图（Logical Causal Graph），
/// key 仅允许 `RELATION_IMPLEMENT`（即 `"implement"`），
/// value 为下游 block_id 列表。
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Block {
    pub block_id: String,
    pub name: String,
    pub block_type: String,
    pub contents: serde_json::Value,
    pub children: HashMap<String, Vec<String>>,
    pub owner: String,

    /// Block metadata with timestamps and custom fields
    pub metadata: BlockMetadata,
}

impl Block {
    pub fn new(name: String, block_type: String, owner: String) -> Self {
        Self {
            block_id: uuid::Uuid::new_v4().to_string(),
            name,
            block_type,
            contents: serde_json::json!({}),
            children: HashMap::new(),
            owner,
            metadata: BlockMetadata::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_block_has_empty_metadata() {
        let block = Block::new(
            "Test Block".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        assert_eq!(block.name, "Test Block");
        assert_eq!(block.block_type, "markdown");
        assert_eq!(block.owner, "alice");
        assert_eq!(block.metadata, BlockMetadata::default());
        assert!(block.metadata.created_at.is_none());
        assert!(block.metadata.updated_at.is_none());
    }

    #[test]
    fn test_block_with_metadata() {
        let mut block = Block::new(
            "Test".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        block.metadata = BlockMetadata {
            description: Some("测试描述".to_string()),
            created_at: Some("2025-12-17T02:30:00Z".to_string()),
            updated_at: Some("2025-12-17T02:30:00Z".to_string()),
            custom: HashMap::new(),
        };

        assert_eq!(block.metadata.description, Some("测试描述".to_string()));
        assert_eq!(
            block.metadata.created_at,
            Some("2025-12-17T02:30:00Z".to_string())
        );
    }
}
