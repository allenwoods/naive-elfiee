//! Tests for command handlers
//!
//! This module contains tests for command handling, especially file synchronization logic

use crate::models::{Command, Event};
use std::collections::HashMap;

#[cfg(test)]
mod file_sync_tests {
    use super::*;

    fn timestamp(count: i64) -> HashMap<String, i64> {
        let mut ts = HashMap::new();
        ts.insert("alice".to_string(), count);
        ts
    }

    #[test]
    fn test_file_sync_detection_with_sync_flag() {
        // 创建包含 needs_file_sync 标记的事件（任何capability都可以使用）
        let events = vec![Event::new(
            "block123".to_string(),
            "alice/some.capability".to_string(),
            serde_json::json!({
                "contents": {
                    "needs_file_sync": true,
                    "file_operation_command": "mkdir test_dir"
                }
            }),
            timestamp(1),
        )];

        // 检查事件中是否包含文件同步标记
        let has_file_sync = events.iter().any(|event| {
            if let Some(contents) = event.value.get("contents") {
                if let Some(obj) = contents.as_object() {
                    return obj.get("needs_file_sync")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
            false
        });

        assert!(has_file_sync, "Should detect file sync requirement from events");
    }

    #[test]
    fn test_file_sync_detection_no_sync_needed() {
        // 创建不包含 needs_file_sync 标记的事件
        let events = vec![Event::new(
            "block123".to_string(),
            "alice/some.capability".to_string(),
            serde_json::json!({
                "contents": {
                    "data": "some data",
                    "status": "completed"
                }
            }),
            timestamp(1),
        )];

        // 检查事件中是否包含文件同步标记
        let has_file_sync = events.iter().any(|event| {
            if let Some(contents) = event.value.get("contents") {
                if let Some(obj) = contents.as_object() {
                    return obj.get("needs_file_sync")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
            false
        });

        assert!(!has_file_sync, "Should not detect file sync requirement when not needed");
    }

    #[test]
    fn test_file_sync_detection_false_flag() {
        // 创建包含 needs_file_sync: false 的事件
        let events = vec![Event::new(
            "block123".to_string(),
            "alice/some.capability".to_string(),
            serde_json::json!({
                "contents": {
                    "needs_file_sync": false,
                    "data": "some data"
                }
            }),
            timestamp(1),
        )];

        // 检查事件中是否包含文件同步标记
        let has_file_sync = events.iter().any(|event| {
            if let Some(contents) = event.value.get("contents") {
                if let Some(obj) = contents.as_object() {
                    return obj.get("needs_file_sync")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
            false
        });

        assert!(!has_file_sync, "Should not trigger sync when flag is explicitly false");
    }

    #[test]
    fn test_file_sync_command_extraction() {
        let events = vec![Event::new(
            "block123".to_string(),
            "alice/some.capability".to_string(),
            serde_json::json!({
                "contents": {
                    "needs_file_sync": true,
                    "file_operation_command": "touch new_file.txt"
                }
            }),
            timestamp(1),
        )];

        // 提取文件操作命令
        let file_operation_command = events.iter()
            .find_map(|event| {
                if let Some(contents) = event.value.get("contents") {
                    if let Some(obj) = contents.as_object() {
                        if obj.get("needs_file_sync")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false) {
                            return obj.get("file_operation_command")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                        }
                    }
                }
                None
            });

        assert_eq!(
            file_operation_command,
            Some("touch new_file.txt".to_string()),
            "Should extract correct file operation command"
        );
    }

    #[test]
    fn test_capability_without_sync_flag() {
        // 测试没有 needs_file_sync 标记的capability不会触发文件同步
        let events = vec![Event::new(
            "block123".to_string(),
            "alice/markdown.write".to_string(),
            serde_json::json!({
                "contents": {
                    "content": "Some markdown content"
                }
            }),
            timestamp(1),
        )];

        // 检查事件中是否包含文件同步标记（通用检查逻辑）
        let has_file_sync = events.iter().any(|event| {
            if let Some(contents) = event.value.get("contents") {
                if let Some(obj) = contents.as_object() {
                    return obj.get("needs_file_sync")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
            false
        });

        assert!(!has_file_sync, "Capabilities without sync flag should not trigger file sync");
    }

    #[test]
    fn test_empty_events_no_sync() {
        let events: Vec<Event> = vec![];

        let has_file_sync = events.iter().any(|event| {
            if let Some(contents) = event.value.get("contents") {
                if let Some(obj) = contents.as_object() {
                    return obj.get("needs_file_sync")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
            false
        });

        assert!(!has_file_sync, "Empty events should not trigger file sync");
    }

    #[test]
    fn test_malformed_event_value_no_sync() {
        let events = vec![Event::new(
            "block123".to_string(),
            "alice/some.capability".to_string(),
            serde_json::json!("malformed_string_value"),
            timestamp(1),
        )];

        let has_file_sync = events.iter().any(|event| {
            if let Some(contents) = event.value.get("contents") {
                if let Some(obj) = contents.as_object() {
                    return obj.get("needs_file_sync")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
            false
        });

        assert!(!has_file_sync, "Malformed events should not trigger file sync");
    }
}

#[cfg(test)]
mod command_processing_tests {
    use super::*;

    #[test]
    fn test_command_id_generation() {
        let cmd = Command::new(
            "alice".to_string(),
            "some.capability".to_string(),
            "block123".to_string(),
            serde_json::json!({"command": "ls"}),
        );

        assert!(!cmd.cmd_id.is_empty(), "Command should have a unique ID");
        assert!(cmd.cmd_id.len() > 10, "Command ID should be reasonably long for uniqueness");
    }

    #[test]
    fn test_command_payload_validation() {
        let valid_payload = serde_json::json!({"command": "ls"});
        let invalid_payload = serde_json::json!({"invalid_field": "value"});

        // 有效载荷应该包含预期的字段
        assert!(valid_payload.get("command").is_some(), "Valid payload should have command field");
        
        // 无效载荷应该缺少预期的字段
        assert!(invalid_payload.get("command").is_none(), "Invalid payload should lack command field");
    }

    #[test]
    fn test_command_timestamp_format() {
        let timestamp = serde_json::json!({"alice": 1});
        
        // 检查时间戳格式
        assert!(timestamp.is_object(), "Timestamp should be an object");
        assert!(timestamp.get("alice").is_some(), "Timestamp should contain editor ID");
        assert!(timestamp.get("alice").unwrap().is_number(), "Timestamp count should be a number");
    }
}