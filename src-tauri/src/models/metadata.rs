use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

/// Block 元数据结构（推荐格式）
///
/// 存储在 Block.metadata 字段中（JSON 格式）。
/// 该结构定义了推荐的 metadata 格式，但不强制所有代码使用。
///
/// # 字段说明
/// * `description` - Block 的详细描述
/// * `created_at` - 创建时间（ISO 8601 UTC 格式，例如："2025-12-17T02:30:00Z"）
/// * `updated_at` - 最后更新时间（ISO 8601 UTC 格式）
/// * `custom` - 自定义扩展字段（使用 #[serde(flatten)] 合并到根对象）
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
pub struct BlockMetadata {
    /// Block 描述
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// 创建时间（ISO 8601 UTC）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    /// 最后更新时间（ISO 8601 UTC）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,

    /// 自定义扩展字段
    #[serde(flatten)]
    pub custom: HashMap<String, serde_json::Value>,
}

impl Default for BlockMetadata {
    fn default() -> Self {
        Self {
            description: None,
            created_at: None,
            updated_at: None,
            custom: HashMap::new(),
        }
    }
}

impl BlockMetadata {
    /// 创建新的 BlockMetadata，自动设置当前时间
    pub fn new() -> Self {
        let now = crate::utils::time::now_utc();
        Self {
            description: None,
            created_at: Some(now.clone()),
            updated_at: Some(now),
            custom: HashMap::new(),
        }
    }

    /// 从 JSON Value 解析 BlockMetadata
    pub fn from_json(value: &serde_json::Value) -> Result<Self, String> {
        serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to parse BlockMetadata: {}", e))
    }

    /// 转换为 JSON Value
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::to_value(self).unwrap_or_else(|_| serde_json::json!({}))
    }

    /// 更新 updated_at 为当前时间
    pub fn touch(&mut self) {
        self.updated_at = Some(crate::utils::time::now_utc());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default() {
        let metadata = BlockMetadata::default();
        assert!(metadata.description.is_none());
        assert!(metadata.created_at.is_none());
        assert!(metadata.updated_at.is_none());
        assert!(metadata.custom.is_empty());
    }

    #[test]
    fn test_new() {
        let metadata = BlockMetadata::new();
        assert!(metadata.created_at.is_some());
        assert!(metadata.updated_at.is_some());

        let created = metadata.created_at.unwrap();
        let updated = metadata.updated_at.unwrap();

        // 应该是有效的 UTC 时间戳
        assert!(created.ends_with('Z'));
        assert!(updated.ends_with('Z'));
    }

    #[test]
    fn test_to_json_and_from_json() {
        let metadata = BlockMetadata {
            description: Some("测试描述".to_string()),
            created_at: Some("2025-12-17T02:30:00Z".to_string()),
            updated_at: Some("2025-12-17T10:15:00Z".to_string()),
            custom: {
                let mut map = HashMap::new();
                map.insert("priority".to_string(), serde_json::json!("high"));
                map
            },
        };

        // 转换为 JSON
        let json = metadata.to_json();
        assert_eq!(json["description"], "测试描述");
        assert_eq!(json["created_at"], "2025-12-17T02:30:00Z");
        assert_eq!(json["priority"], "high");

        // 从 JSON 恢复
        let restored = BlockMetadata::from_json(&json).unwrap();
        assert_eq!(restored, metadata);
    }

    #[test]
    fn test_touch() {
        let mut metadata = BlockMetadata {
            description: Some("测试".to_string()),
            created_at: Some("2025-12-17T02:30:00Z".to_string()),
            updated_at: Some("2025-12-17T02:30:00Z".to_string()),
            custom: HashMap::new(),
        };

        let original_updated = metadata.updated_at.clone().unwrap();

        // 等待一小段时间
        std::thread::sleep(std::time::Duration::from_millis(10));

        // 更新时间戳
        metadata.touch();

        let new_updated = metadata.updated_at.clone().unwrap();

        // updated_at 应该变化，created_at 不变
        assert_eq!(metadata.created_at.unwrap(), "2025-12-17T02:30:00Z");
        assert_ne!(original_updated, new_updated);
    }

    #[test]
    fn test_serialization_omits_none() {
        let metadata = BlockMetadata {
            description: Some("测试".to_string()),
            created_at: None,
            updated_at: None,
            custom: HashMap::new(),
        };

        let json = serde_json::to_value(&metadata).unwrap();

        // None 字段不应该出现在 JSON 中
        assert!(json["description"].is_string());
        assert!(json.get("created_at").is_none() || json["created_at"].is_null());
        assert!(json.get("updated_at").is_none() || json["updated_at"].is_null());
    }

    #[test]
    fn test_custom_fields() {
        let json = serde_json::json!({
            "description": "测试",
            "created_at": "2025-12-17T02:30:00Z",
            "custom_field_1": "value1",
            "custom_field_2": 42
        });

        let metadata = BlockMetadata::from_json(&json).unwrap();

        assert_eq!(metadata.description, Some("测试".to_string()));
        assert_eq!(metadata.custom.get("custom_field_1").unwrap(), "value1");
        assert_eq!(
            metadata.custom.get("custom_field_2").unwrap(),
            &serde_json::json!(42)
        );
    }
}
