//! Tests for Code extension

use super::*;
use crate::capabilities::registry::CapabilityRegistry;
use crate::models::{Block, Command};
use serde_json::json;

#[test]
fn test_code_read_basic() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("code.read").unwrap();
    let block = Block::new(
        "test.rs".to_string(),
        "code".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "code.read".to_string(),
        block.block_id.clone(),
        json!({}),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_ok());
    let events = result.unwrap();
    assert_eq!(events.len(), 0);
}

#[test]
fn test_code_write_basic() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("code.write").unwrap();
    let block = Block::new(
        "test.rs".to_string(),
        "code".to_string(),
        "alice".to_string(),
    );

    let content = "fn main() { println!(\"Hello\"); }";
    let cmd = Command::new(
        "alice".to_string(),
        "code.write".to_string(),
        block.block_id.clone(),
        json!({
            "content": content
        }),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_ok());

    let events = result.unwrap();
    assert_eq!(events.len(), 1);

    let event = &events[0];
    assert_eq!(event.value["contents"]["text"], content);
    assert!(event.value["metadata"].get("updated_at").is_some());
}

#[test]
fn test_code_write_payload_deserialization() {
    let json = json!({
        "content": "some code"
    });

    let payload: Result<CodeWritePayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok());
    assert_eq!(payload.unwrap().content, "some code");
}
