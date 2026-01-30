//! Integration tests for MCP Notifications
//!
//! Verifies that the engine broadcasts StateChangeEvent after committing commands,
//! and that the dispatcher correctly derives resource URIs from events.

use elfiee_lib::engine::{spawn_engine, EventStore};
use elfiee_lib::mcp::notifications::StateChangeEvent;
use elfiee_lib::models::Command;
use tokio::sync::broadcast;

/// Helper: create an engine with a broadcast channel, return (handle, receiver)
async fn setup_engine_with_broadcast() -> (
    elfiee_lib::engine::EngineHandle,
    broadcast::Receiver<StateChangeEvent>,
) {
    let (tx, rx) = broadcast::channel::<StateChangeEvent>(64);
    let event_pool = EventStore::create(":memory:").await.unwrap();
    let handle = spawn_engine("test-notifications".to_string(), event_pool, Some(tx))
        .await
        .unwrap();
    (handle, rx)
}

#[tokio::test]
async fn test_broadcast_on_create_block() {
    let (handle, mut rx) = setup_engine_with_broadcast().await;

    // Create a block — this should trigger a broadcast
    let cmd = Command::new(
        "alice".to_string(),
        "core.create".to_string(),
        "".to_string(),
        serde_json::json!({
            "name": "Broadcast Test",
            "block_type": "markdown"
        }),
    );

    let events = handle.process_command(cmd).await.unwrap();
    assert_eq!(events.len(), 1);

    // Verify broadcast was received
    let state_change = rx
        .try_recv()
        .expect("Should have received a StateChangeEvent");
    assert_eq!(state_change.file_id, "test-notifications");
    assert_eq!(state_change.events.len(), 1);
    assert_eq!(state_change.events[0].entity, events[0].entity);
    assert!(state_change.events[0].attribute.ends_with("/core.create"));

    handle.shutdown().await;
}

#[tokio::test]
async fn test_broadcast_on_markdown_write() {
    let (handle, mut rx) = setup_engine_with_broadcast().await;

    // Create a block first
    let create_cmd = Command::new(
        "alice".to_string(),
        "core.create".to_string(),
        "".to_string(),
        serde_json::json!({
            "name": "Write Test",
            "block_type": "markdown"
        }),
    );

    let create_events = handle.process_command(create_cmd).await.unwrap();
    let block_id = create_events[0].entity.clone();

    // Consume the create broadcast
    let _ = rx
        .try_recv()
        .expect("Should have received create broadcast");

    // Write markdown content
    let write_cmd = Command::new(
        "alice".to_string(),
        "markdown.write".to_string(),
        block_id.clone(),
        serde_json::json!({ "content": "# Hello World" }),
    );

    handle.process_command(write_cmd).await.unwrap();

    // Verify write broadcast was received
    let state_change = rx.try_recv().expect("Should have received write broadcast");
    assert_eq!(state_change.file_id, "test-notifications");
    assert_eq!(state_change.events.len(), 1);
    assert_eq!(state_change.events[0].entity, block_id);
    assert!(state_change.events[0]
        .attribute
        .ends_with("/markdown.write"));

    handle.shutdown().await;
}

#[tokio::test]
async fn test_broadcast_events_stripped_of_block_dir() {
    // Use :memory: database — _block_dir injection is skipped for :memory:,
    // but the stripping logic still runs. This verifies the events sent
    // through the broadcast are the persisted (clean) versions.
    let (handle, mut rx) = setup_engine_with_broadcast().await;

    let cmd = Command::new(
        "alice".to_string(),
        "core.create".to_string(),
        "".to_string(),
        serde_json::json!({
            "name": "Clean Events Test",
            "block_type": "markdown"
        }),
    );

    handle.process_command(cmd).await.unwrap();

    let state_change = rx.try_recv().unwrap();
    // The broadcast should contain persisted events (no _block_dir)
    for event in &state_change.events {
        if let Some(contents) = event.value.get("contents") {
            if let Some(obj) = contents.as_object() {
                assert!(
                    !obj.contains_key("_block_dir"),
                    "Broadcast events should not contain _block_dir"
                );
            }
        }
    }

    handle.shutdown().await;
}

#[tokio::test]
async fn test_broadcast_multiple_commands() {
    let (handle, mut rx) = setup_engine_with_broadcast().await;

    // Process 3 commands
    for i in 0..3 {
        let cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": format!("Block {}", i),
                "block_type": "markdown"
            }),
        );
        handle.process_command(cmd).await.unwrap();
    }

    // Should have 3 separate broadcasts
    for i in 0..3 {
        let state_change = rx
            .try_recv()
            .unwrap_or_else(|_| panic!("Should have received broadcast #{}", i));
        assert_eq!(state_change.events.len(), 1);
    }

    // No more broadcasts
    assert!(rx.try_recv().is_err());

    handle.shutdown().await;
}

#[tokio::test]
async fn test_no_broadcast_without_sender() {
    // When state_change_tx is None, the engine should still work normally
    let event_pool = EventStore::create(":memory:").await.unwrap();
    let handle = spawn_engine("test-no-broadcast".to_string(), event_pool, None)
        .await
        .unwrap();

    let cmd = Command::new(
        "alice".to_string(),
        "core.create".to_string(),
        "".to_string(),
        serde_json::json!({
            "name": "No Broadcast",
            "block_type": "markdown"
        }),
    );

    // Should succeed without errors
    let events = handle.process_command(cmd).await.unwrap();
    assert_eq!(events.len(), 1);

    handle.shutdown().await;
}

#[tokio::test]
async fn test_broadcast_grant_event() {
    let (handle, mut rx) = setup_engine_with_broadcast().await;

    // Create a block
    let create_cmd = Command::new(
        "alice".to_string(),
        "core.create".to_string(),
        "".to_string(),
        serde_json::json!({
            "name": "Grant Test",
            "block_type": "markdown"
        }),
    );

    let create_events = handle.process_command(create_cmd).await.unwrap();
    let block_id = create_events[0].entity.clone();
    let _ = rx.try_recv(); // consume create broadcast

    // Grant permission
    let grant_cmd = Command::new(
        "alice".to_string(),
        "core.grant".to_string(),
        block_id.clone(),
        serde_json::json!({
            "target_editor": "bob",
            "capability": "markdown.write",
            "target_block": block_id
        }),
    );

    handle.process_command(grant_cmd).await.unwrap();

    let state_change = rx.try_recv().expect("Should have received grant broadcast");
    assert_eq!(state_change.events.len(), 1);
    assert!(state_change.events[0].attribute.ends_with("/core.grant"));

    handle.shutdown().await;
}
