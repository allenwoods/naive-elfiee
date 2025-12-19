use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

use super::BlockMetadata;

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
