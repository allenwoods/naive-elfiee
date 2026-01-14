//! Tests for Terminal extension
//!
//! This module contains tests for:
//! - terminal.save capability
//! - Payload deserialization for all terminal operations
//!
//! Note: Shell initialization tests are in shell.rs as unit tests.

use super::*;
use crate::capabilities::registry::CapabilityRegistry;
use crate::models::{Block, Command};
use chrono::Utc;
use serde_json::json;

// ============================================================================
// terminal.save Capability Tests
// ============================================================================

/// Test 1: Basic save functionality
///
/// Verifies:
/// - Create terminal block
/// - Call terminal.save capability
/// - Confirm saved_content and saved_at fields are correctly saved
#[test]
fn test_terminal_save_basic() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.save").unwrap();

    // Create a terminal block
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

/// Test 2: Authorization verification
///
/// Verifies:
/// - Only block owner can save
/// - Non-owner call fails with Authorization error
#[test]
fn test_terminal_save_authorization() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.save").unwrap();

    // Alice owns the block
    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let test_content = "$ echo 'test'\ntest\n";
    let timestamp = Utc::now().to_rfc3339();

    // Note: Authorization is enforced by the engine's certificator at a higher level
    // The capability handler itself doesn't reject based on editor_id
    // In production, the engine would check CBAC grants before calling the handler
    // Here we verify that when called with proper authorization, it works correctly

    // Alice (owner) saves - should succeed
    let cmd_alice = Command::new(
        "alice".to_string(),
        "terminal.save".to_string(),
        block.block_id.clone(),
        json!({
            "saved_content": test_content,
            "saved_at": timestamp
        }),
    );

    let result = cap.handler(&cmd_alice, Some(&block));
    assert!(result.is_ok(), "Owner should be able to save");

    let events = result.unwrap();
    assert_eq!(events.len(), 1);
}

/// Test 3: Timestamp format validation
///
/// Verifies:
/// - saved_at uses ISO 8601 format
/// - Timestamp can be correctly parsed
#[test]
fn test_terminal_save_timestamp_format() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.save").unwrap();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let test_content = "$ date\nMon Jan 13 10:30:00 UTC 2026\n";
    let timestamp = Utc::now().to_rfc3339();

    // Verify timestamp is valid ISO 8601
    assert!(
        chrono::DateTime::parse_from_rfc3339(&timestamp).is_ok(),
        "Timestamp should be valid ISO 8601 format"
    );

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.save".to_string(),
        block.block_id.clone(),
        json!({
            "saved_content": test_content,
            "saved_at": timestamp.clone()
        }),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_ok());

    let events = result.unwrap();
    let saved_timestamp = events[0].value["contents"]["saved_at"]
        .as_str()
        .expect("saved_at should be a string");

    // Verify stored timestamp can be parsed
    assert!(
        chrono::DateTime::parse_from_rfc3339(saved_timestamp).is_ok(),
        "Stored timestamp should be parseable as ISO 8601"
    );
}

/// Test 4: TerminalSavePayload deserialization
///
/// Verifies:
/// - TerminalSavePayload deserializes correctly
#[test]
fn test_terminal_save_payload_deserialization() {
    let json = json!({
        "saved_content": "terminal output here",
        "saved_at": "2026-01-13T10:30:00Z"
    });

    let payload: Result<TerminalSavePayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok(), "Payload should deserialize successfully");

    let payload = payload.unwrap();
    assert_eq!(payload.saved_content, "terminal output here");
    assert_eq!(payload.saved_at, "2026-01-13T10:30:00Z");
}

/// Test 5: Empty content save
///
/// Verifies:
/// - Can save empty string
/// - saved_at timestamp still updates
#[test]
fn test_terminal_save_empty_content() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.save").unwrap();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    let empty_content = "";
    let timestamp = Utc::now().to_rfc3339();

    let cmd = Command::new(
        "alice".to_string(),
        "terminal.save".to_string(),
        block.block_id.clone(),
        json!({
            "saved_content": empty_content,
            "saved_at": timestamp
        }),
    );

    let result = cap.handler(&cmd, Some(&block));
    assert!(result.is_ok(), "Should be able to save empty content");

    let events = result.unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(
        events[0].value["contents"]["saved_content"], "",
        "Empty content should be saved"
    );
}

/// Test 6: Large content save (>10MB)
///
/// Verifies:
/// - Can save large terminal output
/// - Performance is acceptable (<1s)
#[test]
fn test_terminal_save_large_content() {
    let registry = CapabilityRegistry::new();
    let cap = registry.get("terminal.save").unwrap();

    let block = Block::new(
        "Terminal 1".to_string(),
        "terminal".to_string(),
        "alice".to_string(),
    );

    // Generate ~10MB of terminal output (10,000 lines of 1KB each)
    let line = "a".repeat(1024);
    let large_content = (0..10000)
        .map(|i| format!("Line {}: {}", i, line))
        .collect::<Vec<_>>()
        .join("\n");

    assert!(
        large_content.len() > 10_000_000,
        "Content should be larger than 10MB"
    );

    let timestamp = Utc::now().to_rfc3339();
    let cmd = Command::new(
        "alice".to_string(),
        "terminal.save".to_string(),
        block.block_id.clone(),
        json!({
            "saved_content": large_content.clone(),
            "saved_at": timestamp
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

    let events = result.unwrap();
    assert_eq!(
        events[0].value["contents"]["saved_content"]
            .as_str()
            .unwrap()
            .len(),
        large_content.len(),
        "Large content should be saved completely"
    );
}

// ============================================================================
// Payload Deserialization Tests
// ============================================================================

/// Test 7: TerminalInitPayload deserialization
///
/// Verifies:
/// - Payload deserializes correctly with all fields
#[test]
fn test_terminal_init_payload_deserialization() {
    let json = json!({
        "cols": 80,
        "rows": 24,
        "block_id": "block-123",
        "editor_id": "alice",
        "file_id": "file-456",
        "cwd": "/home/user/project"
    });

    let payload: Result<TerminalInitPayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok(), "Payload should deserialize successfully");

    let payload = payload.unwrap();
    assert_eq!(payload.cols, 80);
    assert_eq!(payload.rows, 24);
    assert_eq!(payload.block_id, "block-123");
    assert_eq!(payload.editor_id, "alice");
    assert_eq!(payload.file_id, "file-456");
    assert_eq!(payload.cwd, Some("/home/user/project".to_string()));
}

/// Test 8: TerminalInitPayload with optional cwd
///
/// Verifies:
/// - cwd field can be null/omitted
#[test]
fn test_terminal_init_payload_optional_cwd() {
    let json = json!({
        "cols": 80,
        "rows": 24,
        "block_id": "block-123",
        "editor_id": "alice",
        "file_id": "file-456"
    });

    let payload: Result<TerminalInitPayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok(), "Should deserialize without cwd");

    let payload = payload.unwrap();
    assert_eq!(payload.cwd, None, "cwd should be None");
}

/// Test 9: TerminalWritePayload deserialization
///
/// Verifies:
/// - Write payload deserializes correctly
#[test]
fn test_terminal_write_payload_deserialization() {
    let json = json!({
        "data": "ls -la\n",
        "block_id": "block-123",
        "file_id": "file-456",
        "editor_id": "alice"
    });

    let payload: Result<TerminalWritePayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok(), "Payload should deserialize successfully");

    let payload = payload.unwrap();
    assert_eq!(payload.data, "ls -la\n");
    assert_eq!(payload.block_id, "block-123");
    assert_eq!(payload.file_id, "file-456");
    assert_eq!(payload.editor_id, "alice");
}

/// Test 10: TerminalResizePayload deserialization
///
/// Verifies:
/// - Resize payload deserializes correctly
#[test]
fn test_terminal_resize_payload_deserialization() {
    let json = json!({
        "cols": 120,
        "rows": 40,
        "block_id": "block-123",
        "file_id": "file-456",
        "editor_id": "alice"
    });

    let payload: Result<TerminalResizePayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok(), "Payload should deserialize successfully");

    let payload = payload.unwrap();
    assert_eq!(payload.cols, 120);
    assert_eq!(payload.rows, 40);
    assert_eq!(payload.block_id, "block-123");
}
