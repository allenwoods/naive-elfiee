use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Block {
    pub block_id: String,
    pub name: String,
    pub block_type: String,
    pub contents: serde_json::Value,
    pub children: HashMap<String, Vec<String>>,
    pub owner: String,

    /// 元数据（灵活的 JSON 对象）
    ///
    /// 推荐使用 BlockMetadata 结构，但不强制。
    /// 默认为空对象 {}
    pub metadata: serde_json::Value,
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
            metadata: serde_json::json!({}),
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
        assert_eq!(block.metadata, serde_json::json!({}));
    }

    #[test]
    fn test_block_with_metadata() {
        let mut block = Block::new(
            "Test".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        block.metadata = serde_json::json!({
            "description": "测试描述",
            "created_at": "2025-12-17T02:30:00Z"
        });

        assert_eq!(block.metadata["description"], "测试描述");
        assert_eq!(block.metadata["created_at"], "2025-12-17T02:30:00Z");
    }
}
