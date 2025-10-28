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
        }
    }
}
