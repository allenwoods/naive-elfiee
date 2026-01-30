//! Tests for Terminal extension
//!
//! Test categories included:
//! - Payload deserialization tests
//! - Capability functionality tests
//! - Authorization/CBAC tests

use super::*;
use crate::capabilities::grants::GrantsTable;
use crate::capabilities::registry::CapabilityRegistry;
use crate::models::{Block, Command};
use chrono::Utc;
use serde_json::json;

// ============================================
// Terminal - Payload Tests
// ============================================

#[test]
fn test_save_payload_deserialize() {
    let json = json!({
        "saved_content": "terminal output here",
        "saved_at": "2026-01-13T10:30:00Z"
    });

    let result: Result<TerminalSavePayload, _> = serde_json::from_value(json);
    assert!(
        result.is_ok(),
        "TerminalSavePayload should deserialize successfully"
    );

    let payload = result.unwrap();
    assert_eq!(payload.saved_content, "terminal output here");
    assert_eq!(payload.saved_at, "2026-01-13T10:30:00Z");
}

#[test]
fn test_init_payload_deserialize() {
    let json = json!({
        "cols": 80,
        "rows": 24,
        "block_id": "block-123",
        "editor_id": "alice",
        "file_id": "file-456",
        "cwd": "/home/user/project"
    });

    let result: Result<TerminalInitPayload, _> = serde_json::from_value(json);
    assert!(
        result.is_ok(),
        "TerminalInitPayload should deserialize successfully"
    );

    let payload = result.unwrap();
    assert_eq!(payload.cols, 80);
    assert_eq!(payload.rows, 24);
    assert_eq!(payload.cwd, Some("/home/user/project".to_string()));
}

#[test]
fn test_execute_payload_deserialize() {
    let json = json!({
        "command": "ls -la",
        "exit_code": 0
    });

    let result: Result<TerminalExecutePayload, _> = serde_json::from_value(json);
    assert!(
        result.is_ok(),
        "TerminalExecutePayload should deserialize successfully"
    );

    let payload = result.unwrap();
    assert_eq!(payload.command, "ls -la");
    assert_eq!(payload.exit_code, Some(0));
}

#[test]
fn test_execute_payload_deserialize_no_exit_code() {
    let json = json!({
        "command": "sleep 10",
        "exit_code": null
    });

    let result: Result<TerminalExecutePayload, _> = serde_json::from_value(json);
    assert!(
        result.is_ok(),
        "TerminalExecutePayload should deserialize with null exit_code"
    );

    let payload = result.unwrap();
    assert_eq!(payload.command, "sleep 10");
    assert_eq!(payload.exit_code, None);
}

// ============================================
// Terminal Capabilities - Functionality Tests
// ============================================

#[test]
fn test_terminal_init_basic() {
    let registry = CapabilityRegistry::new();
    let cap = registry
        .get("terminal.init")
        .expect("terminal.init should be registered");

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.init".to_string(),
        block.block_id.clone(),
        json!({
            "cols": 80,
            "rows": 24
        }),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_ok(), "terminal.init should succeed");

    let events = result.unwrap();
    assert_eq!(
        events.len(),
        1,
        "terminal.init should return 1 event (session_started)"
    );

    // Verify event content
    let event = &events[0];
    assert_eq!(event.entity, block.block_id);
    assert!(event.attribute.contains("terminal.init"));
    assert_eq!(event.value["session_started"], true);
    assert!(event.value["started_at"].is_string());
}

#[test]
fn test_terminal_close_basic() {
    let registry = CapabilityRegistry::new();
    let cap = registry
        .get("terminal.close")
        .expect("terminal.close should be registered");

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.close".to_string(),
        block.block_id.clone(),
        json!({}),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_ok(), "terminal.close should succeed");

    let events = result.unwrap();
    assert_eq!(
        events.len(),
        1,
        "terminal.close should return 1 event (session_closed)"
    );

    // Verify event content
    let event = &events[0];
    assert_eq!(event.entity, block.block_id);
    assert!(event.attribute.contains("terminal.close"));
    assert_eq!(event.value["session_closed"], true);
    assert!(event.value["closed_at"].is_string());
}

#[test]
fn test_terminal_execute_basic() {
    let registry = CapabilityRegistry::new();
    let cap = registry
        .get("terminal.execute")
        .expect("terminal.execute should be registered");

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.execute".to_string(),
        block.block_id.clone(),
        json!({
            "command": "ls -la",
            "exit_code": 0
        }),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_ok(), "terminal.execute should succeed");

    let events = result.unwrap();
    assert_eq!(
        events.len(),
        1,
        "terminal.execute should return 1 event (command_executed)"
    );

    // Verify event content
    let event = &events[0];
    assert_eq!(event.entity, block.block_id);
    assert!(event.attribute.contains("terminal.execute"));
    assert_eq!(event.value["command"], "ls -la");
    assert_eq!(event.value["exit_code"], 0);
    assert!(event.value["executed_at"].is_string());
}

// ============================================
// TerminalSave - Functionality Tests
// ============================================

#[test]
fn test_save_basic() {
    let registry = CapabilityRegistry::new();
    let cap = registry
        .get("terminal.save")
        .expect("terminal.save should be registered");

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let test_content = "$ ls\nfile1.txt\nfile2.txt\n$ pwd\n/home/user\n";
    let timestamp = Utc::now().to_rfc3339();

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.save".to_string(),
        block.block_id.clone(),
        json!({
            "saved_content": test_content,
            "saved_at": timestamp
        }),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_ok(), "terminal.save should succeed");

    let events = result.unwrap();
    assert_eq!(events.len(), 1, "Should generate exactly one event");

    let event = &events[0];
    assert_eq!(
        event.value["contents"]["saved_content"], test_content,
        "Saved content should match"
    );
    assert_eq!(
        event.value["contents"]["saved_at"], timestamp,
        "Timestamp should match"
    );
}

#[test]
fn test_save_empty_content_edge_case() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.save").unwrap();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.save".to_string(),
        block.block_id.clone(),
        json!({
            "saved_content": "",
            "saved_at": Utc::now().to_rfc3339()
        }),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_ok(), "Should be able to save empty content");

    let events = result.unwrap();
    assert_eq!(events[0].value["contents"]["saved_content"], "");
}

#[test]
fn test_save_large_content_performance() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.save").unwrap();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    // Generate ~10MB of terminal output
    let line = "a".repeat(1024);
    let large_content = (0..10000)
        .map(|i| format!("Line {}: {}", i, line))
        .collect::<Vec<_>>()
        .join("\n");

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.save".to_string(),
        block.block_id.clone(),
        json!({
            "saved_content": large_content,
            "saved_at": Utc::now().to_rfc3339()
        }),
    );

    let start = std::time::Instant::now();
    let result = cap.handler(&cmd, Some(&block));
    let duration = start.elapsed();

    assert!(result.is_ok(), "Should handle large content");
    assert!(
        duration.as_secs() < 1,
        "Should complete in less than 1 second, took {:?}",
        duration
    );
}

// ============================================
// Terminal - Block Type Validation Tests
// ============================================

#[test]
fn test_terminal_init_wrong_type_error() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.init").unwrap();

    // Create a markdown block instead of terminal
    let block = Block::new(
        "Document".to_string(),
        "markdown".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.init".to_string(),
        block.block_id.clone(),
        json!({}),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_err(), "Should fail for non-terminal block");
    assert!(
        result
            .unwrap_err()
            .contains("Expected block_type 'terminal'"),
        "Error should mention expected block type"
    );
}

#[test]
fn test_terminal_close_wrong_type_error() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.close").unwrap();

    // Create a markdown block instead of terminal
    let block = Block::new(
        "Document".to_string(),
        "markdown".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.close".to_string(),
        block.block_id.clone(),
        json!({}),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_err(), "Should fail for non-terminal block");
    assert!(
        result
            .unwrap_err()
            .contains("Expected block_type 'terminal'"),
        "Error should mention expected block type"
    );
}

#[test]
fn test_terminal_save_wrong_type_error() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.save").unwrap();

    // Create a markdown block instead of terminal
    let block = Block::new(
        "Document".to_string(),
        "markdown".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.save".to_string(),
        block.block_id.clone(),
        json!({
            "saved_content": "test",
            "saved_at": "2026-01-20T10:30:00Z"
        }),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_err(), "Should fail for non-terminal block");
    assert!(
        result
            .unwrap_err()
            .contains("Expected block_type 'terminal'"),
        "Error should mention expected block type"
    );
}

#[test]
fn test_terminal_execute_wrong_type_error() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.execute").unwrap();

    // Create a markdown block instead of terminal
    let block = Block::new(
        "Document".to_string(),
        "markdown".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.execute".to_string(),
        block.block_id.clone(),
        json!({
            "command": "ls",
            "exit_code": 0
        }),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_err(), "Should fail for non-terminal block");
    assert!(
        result
            .unwrap_err()
            .contains("Expected block_type 'terminal'"),
        "Error should mention expected block type"
    );
}

#[test]
fn test_terminal_missing_block_error() {
    let registry = CapabilityRegistry::new();

    // Note: terminal.write and terminal.resize are direct PTY operations
    // without capability checks. Test all event-producing capabilities.
    let capabilities = [
        "terminal.init",
        "terminal.execute",
        "terminal.save",
        "terminal.close",
    ];

    for cap_id in capabilities {
        let cap = registry.get(cap_id).unwrap();

        let cmd = Command::new(
            "alice".to_string(),
            cap_id.to_string(),
            "nonexistent-block".to_string(),
            json!({
                "saved_content": "test",
                "saved_at": "2026-01-13T10:30:00Z"
            }),
        );

        let result = cap.handler(&cmd, None);
        assert!(result.is_err(), "{} should fail without block", cap_id);
        assert!(
            result.unwrap_err().contains("Block required"),
            "{} error should mention block required",
            cap_id
        );
    }
}

// ============================================
// TerminalSave - Authorization (CBAC) Tests
// ============================================

#[test]
fn test_save_authorization_owner() {
    let grants_table = GrantsTable::new();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    // Owner should always be authorized
    let is_authorized =
        block.owner == "alice" || grants_table.has_grant("alice", "terminal.save", &block.block_id);

    assert!(is_authorized, "Block owner should be authorized");
}

#[test]
fn test_save_authorization_non_owner_without_grant() {
    let grants_table = GrantsTable::new();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    // Bob (non-owner) without grant should not be authorized
    let is_authorized =
        block.owner == "bob" || grants_table.has_grant("bob", "terminal.save", &block.block_id);

    assert!(
        !is_authorized,
        "Non-owner without grant should not be authorized"
    );
}

#[test]
fn test_save_authorization_non_owner_with_grant() {
    let mut grants_table = GrantsTable::new();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    // Grant Bob permission
    grants_table.add_grant(
        "bob".to_string(),
        "terminal.save".to_string(),
        block.block_id.clone(),
    );

    let is_authorized =
        block.owner == "bob" || grants_table.has_grant("bob", "terminal.save", &block.block_id);

    assert!(is_authorized, "Non-owner with grant should be authorized");
}

// ============================================
// Terminal Init/Close - Event Content Tests
// ============================================

#[test]
fn test_terminal_init_event_content() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.init").unwrap();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.init".to_string(),
        block.block_id.clone(),
        json!({
            "cols": 80,
            "rows": 24
        }),
    );

    let events = cap.handler(&cmd, Some(&block)).unwrap();
    let event = &events[0];

    // Verify event structure
    assert_eq!(event.entity, block.block_id);
    assert_eq!(event.attribute, "alice/terminal.init");
    assert_eq!(event.value["session_started"], true);

    // Verify started_at is a valid timestamp
    let started_at = event.value["started_at"].as_str().unwrap();
    assert!(
        chrono::DateTime::parse_from_rfc3339(started_at).is_ok(),
        "started_at should be valid RFC3339 timestamp"
    );
}

#[test]
fn test_terminal_close_event_content() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.close").unwrap();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.close".to_string(),
        block.block_id.clone(),
        json!({}),
    );

    let events = cap.handler(&cmd, Some(&block)).unwrap();
    let event = &events[0];

    // Verify event structure
    assert_eq!(event.entity, block.block_id);
    assert_eq!(event.attribute, "alice/terminal.close");
    assert_eq!(event.value["session_closed"], true);

    // Verify closed_at is a valid timestamp
    let closed_at = event.value["closed_at"].as_str().unwrap();
    assert!(
        chrono::DateTime::parse_from_rfc3339(closed_at).is_ok(),
        "closed_at should be valid RFC3339 timestamp"
    );
}

#[test]
fn test_terminal_execute_event_content() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.execute").unwrap();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.execute".to_string(),
        block.block_id.clone(),
        json!({
            "command": "echo hello",
            "exit_code": 0
        }),
    );

    let events = cap.handler(&cmd, Some(&block)).unwrap();
    let event = &events[0];

    // Verify event structure
    assert_eq!(event.entity, block.block_id);
    assert_eq!(event.attribute, "alice/terminal.execute");
    assert_eq!(event.value["command"], "echo hello");
    assert_eq!(event.value["exit_code"], 0);

    // Verify executed_at is a valid timestamp
    let executed_at = event.value["executed_at"].as_str().unwrap();
    assert!(
        chrono::DateTime::parse_from_rfc3339(executed_at).is_ok(),
        "executed_at should be valid RFC3339 timestamp"
    );
}

#[test]
fn test_terminal_execute_with_null_exit_code() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.execute").unwrap();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.execute".to_string(),
        block.block_id.clone(),
        json!({
            "command": "sleep 100",
            "exit_code": null
        }),
    );

    let events = cap.handler(&cmd, Some(&block)).unwrap();
    let event = &events[0];

    assert_eq!(event.value["command"], "sleep 100");
    assert!(event.value["exit_code"].is_null());
}
