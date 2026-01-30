//! Integration tests for MCP Standalone Mode
//!
//! Tests the complete standalone MCP server flow:
//! - CLI argument parsing
//! - Standalone engine creation with WAL mode
//! - MCP editor auto-creation
//! - Block operations via standalone engine
//! - State reload (simulating GUI refresh)
//!
//! Run: cargo test --test mcp_standalone_integration

use elfiee_lib::elf::ElfArchive;
use elfiee_lib::engine::standalone::{create_standalone_engine, MCP_EDITOR_ID, MCP_EDITOR_NAME};
use elfiee_lib::mcp::standalone::parse_mcp_args;
use elfiee_lib::models::Command;
use elfiee_lib::state::AppState;
use std::sync::Arc;
use tempfile::NamedTempFile;

// ============================================================================
// CLI Argument Parsing Tests
// ============================================================================

#[test]
fn test_parse_mcp_args_valid() {
    let args = vec![
        "elfiee".to_string(),
        "mcp-server".to_string(),
        "--elf".to_string(),
        "/path/to/project.elf".to_string(),
    ];
    let result = parse_mcp_args(&args);
    assert!(result.is_some());
    assert_eq!(result.unwrap().to_string_lossy(), "/path/to/project.elf");
}

#[test]
fn test_parse_mcp_args_no_subcommand() {
    // Normal GUI launch — no mcp-server subcommand
    let args = vec!["elfiee".to_string()];
    assert!(parse_mcp_args(&args).is_none());
}

#[test]
fn test_parse_mcp_args_wrong_subcommand() {
    let args = vec!["elfiee".to_string(), "other-command".to_string()];
    assert!(parse_mcp_args(&args).is_none());
}

#[test]
fn test_parse_mcp_args_missing_elf_flag() {
    // mcp-server without --elf
    let args = vec!["elfiee".to_string(), "mcp-server".to_string()];
    assert!(parse_mcp_args(&args).is_none());
}

#[test]
fn test_parse_mcp_args_missing_elf_path() {
    // --elf without a path value
    let args = vec![
        "elfiee".to_string(),
        "mcp-server".to_string(),
        "--elf".to_string(),
    ];
    assert!(parse_mcp_args(&args).is_none());
}

#[test]
fn test_parse_mcp_args_windows_path() {
    let args = vec![
        "elfiee".to_string(),
        "mcp-server".to_string(),
        "--elf".to_string(),
        "D:\\workspace\\project.elf".to_string(),
    ];
    let result = parse_mcp_args(&args);
    assert!(result.is_some());
    assert_eq!(
        result.unwrap().to_string_lossy(),
        "D:\\workspace\\project.elf"
    );
}

// ============================================================================
// Standalone Engine Tests
// ============================================================================

/// Helper: create a temp .elf file for testing
async fn create_temp_elf() -> (std::path::PathBuf, NamedTempFile) {
    let archive = ElfArchive::new().await.unwrap();
    let temp_file = NamedTempFile::new().unwrap();
    let elf_path = temp_file.path().with_extension("elf");
    archive.save(&elf_path).unwrap();
    (elf_path, temp_file)
}

#[tokio::test]
async fn test_standalone_engine_creates_successfully() {
    let (elf_path, _temp) = create_temp_elf().await;

    let app_state = create_standalone_engine(&elf_path).await.unwrap();

    // Should have exactly one open file
    let files = app_state.list_open_files();
    assert_eq!(files.len(), 1, "Should have exactly one open file");
}

#[tokio::test]
async fn test_standalone_engine_registers_file() {
    let (elf_path, _temp) = create_temp_elf().await;

    let app_state = create_standalone_engine(&elf_path).await.unwrap();

    // The file_id should be the elf_path string
    let file_id = elf_path.to_string_lossy().to_string();
    assert!(
        app_state.engine_manager.has_engine(&file_id),
        "Engine should be registered for the file"
    );
}

#[tokio::test]
async fn test_standalone_engine_creates_mcp_editor() {
    let (elf_path, _temp) = create_temp_elf().await;

    let app_state = create_standalone_engine(&elf_path).await.unwrap();
    let file_id = elf_path.to_string_lossy().to_string();
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();

    // MCP editor should exist
    let editors = handle.get_all_editors().await;
    assert!(
        editors.contains_key(MCP_EDITOR_ID),
        "MCP editor '{}' should be created",
        MCP_EDITOR_ID
    );

    // Editor should have the correct name
    let editor = editors.get(MCP_EDITOR_ID).unwrap();
    assert_eq!(editor.name, MCP_EDITOR_NAME);
}

#[tokio::test]
async fn test_standalone_engine_sets_active_editor() {
    let (elf_path, _temp) = create_temp_elf().await;

    let app_state = create_standalone_engine(&elf_path).await.unwrap();
    let file_id = elf_path.to_string_lossy().to_string();

    // Active editor should be the MCP editor
    let active = app_state.get_active_editor(&file_id);
    assert_eq!(
        active,
        Some(MCP_EDITOR_ID.to_string()),
        "Active editor should be '{}'",
        MCP_EDITOR_ID
    );
}

#[tokio::test]
async fn test_standalone_engine_wal_mode() {
    let (elf_path, _temp) = create_temp_elf().await;

    let app_state = create_standalone_engine(&elf_path).await.unwrap();
    let file_id = elf_path.to_string_lossy().to_string();
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();

    // Engine should be functional — test by creating a block
    let cmd = Command::new(
        MCP_EDITOR_ID.to_string(),
        "core.create".to_string(),
        "temp".to_string(),
        serde_json::json!({
            "block_type": "markdown",
            "name": "WAL Test Block"
        }),
    );

    let events = handle.process_command(cmd).await.unwrap();
    assert!(!events.is_empty(), "Should produce at least one event");
}

#[tokio::test]
async fn test_standalone_engine_nonexistent_file() {
    let path = std::path::PathBuf::from("/nonexistent/path/file.elf");
    let result = create_standalone_engine(&path).await;
    assert!(result.is_err(), "Should fail for nonexistent file");
}

// ============================================================================
// Block Operations via Standalone Engine
// ============================================================================

/// Helper: create standalone engine with a pre-created markdown block
async fn setup_standalone_with_block() -> (Arc<AppState>, String, String) {
    let (elf_path, _temp) = create_temp_elf().await;
    // Keep _temp alive by leaking it (test only)
    std::mem::forget(_temp);

    let app_state = create_standalone_engine(&elf_path).await.unwrap();
    let file_id = elf_path.to_string_lossy().to_string();

    // Create a markdown block
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();
    let cmd = Command::new(
        MCP_EDITOR_ID.to_string(),
        "core.create".to_string(),
        "temp".to_string(),
        serde_json::json!({
            "block_type": "markdown",
            "name": "Test Block"
        }),
    );
    let events = handle.process_command(cmd).await.unwrap();
    let block_id = events[0].entity.clone();

    (app_state, file_id, block_id)
}

#[tokio::test]
async fn test_standalone_create_and_read_block() {
    let (app_state, file_id, block_id) = setup_standalone_with_block().await;
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();

    // Block should exist
    let block = handle.get_block(block_id.clone()).await;
    assert!(block.is_some(), "Block should exist after creation");

    let block = block.unwrap();
    assert_eq!(block.name, "Test Block");
    assert_eq!(block.block_type, "markdown");
}

#[tokio::test]
async fn test_standalone_markdown_write_and_read() {
    let (app_state, file_id, block_id) = setup_standalone_with_block().await;
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();

    // Write markdown content
    let write_cmd = Command::new(
        MCP_EDITOR_ID.to_string(),
        "markdown.write".to_string(),
        block_id.clone(),
        serde_json::json!({
            "content": "# Hello from MCP\n\nThis was written by the standalone MCP server."
        }),
    );
    let events = handle.process_command(write_cmd).await.unwrap();
    assert!(!events.is_empty(), "Write should produce events");

    // Read markdown content — markdown.read returns a read event with the content
    let read_cmd = Command::new(
        MCP_EDITOR_ID.to_string(),
        "markdown.read".to_string(),
        block_id.clone(),
        serde_json::json!({}),
    );
    let read_events = handle.process_command(read_cmd).await.unwrap();
    assert!(
        !read_events.is_empty(),
        "markdown.read should return event(s) containing the content"
    );
}

#[tokio::test]
async fn test_standalone_multiple_blocks() {
    let (app_state, file_id, _block_id) = setup_standalone_with_block().await;
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();

    // Create a second block
    let cmd = Command::new(
        MCP_EDITOR_ID.to_string(),
        "core.create".to_string(),
        "temp".to_string(),
        serde_json::json!({
            "block_type": "code",
            "name": "Code Block"
        }),
    );
    handle.process_command(cmd).await.unwrap();

    // Should have 2 blocks
    let blocks = handle.get_all_blocks().await;
    assert_eq!(blocks.len(), 2, "Should have 2 blocks");
}

// ============================================================================
// Reload State Tests
// ============================================================================

#[tokio::test]
async fn test_reload_state_returns_event_count() {
    let (app_state, file_id, _block_id) = setup_standalone_with_block().await;
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();

    // Reload state
    let event_count = handle.reload_state().await.unwrap();

    // Should have events from: editor.create + core.create (at minimum)
    assert!(
        event_count >= 2,
        "Should have at least 2 events (editor.create + core.create), got {}",
        event_count
    );
}

#[tokio::test]
async fn test_reload_state_preserves_blocks() {
    let (app_state, file_id, block_id) = setup_standalone_with_block().await;
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();

    // Write content before reload
    let write_cmd = Command::new(
        MCP_EDITOR_ID.to_string(),
        "markdown.write".to_string(),
        block_id.clone(),
        serde_json::json!({
            "content": "# Content before reload"
        }),
    );
    handle.process_command(write_cmd).await.unwrap();

    // Reload state from DB
    let event_count = handle.reload_state().await.unwrap();
    assert!(
        event_count >= 3,
        "Should have at least 3 events after write"
    );

    // Block should still exist after reload
    let block = handle.get_block(block_id.clone()).await;
    assert!(block.is_some(), "Block should exist after reload");
    assert_eq!(block.unwrap().name, "Test Block");
}

#[tokio::test]
async fn test_reload_state_multiple_times() {
    let (app_state, file_id, _block_id) = setup_standalone_with_block().await;
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();

    // Reload multiple times — should be idempotent
    let count1 = handle.reload_state().await.unwrap();
    let count2 = handle.reload_state().await.unwrap();
    let count3 = handle.reload_state().await.unwrap();

    assert_eq!(count1, count2, "Reload should be idempotent");
    assert_eq!(count2, count3, "Reload should be idempotent");
}

// ============================================================================
// Error Handling Tests
// ============================================================================

#[tokio::test]
async fn test_standalone_unauthorized_editor() {
    let (app_state, file_id, block_id) = setup_standalone_with_block().await;
    let handle = app_state.engine_manager.get_engine(&file_id).unwrap();

    // Create a second editor with no grants
    let create_editor_cmd = Command::new(
        MCP_EDITOR_ID.to_string(),
        "editor.create".to_string(),
        String::new(),
        serde_json::json!({
            "editor_id": "unauthorized-user",
            "name": "Unauthorized User"
        }),
    );
    handle.process_command(create_editor_cmd).await.unwrap();

    // Try to write as unauthorized editor — should fail
    let write_cmd = Command::new(
        "unauthorized-user".to_string(),
        "markdown.write".to_string(),
        block_id.clone(),
        serde_json::json!({
            "content": "This should fail"
        }),
    );
    let result = handle.process_command(write_cmd).await;
    assert!(
        result.is_err(),
        "Unauthorized editor should not be able to write"
    );
}

// ============================================================================
// Engine Shutdown Tests
// ============================================================================

#[tokio::test]
async fn test_standalone_engine_shutdown() {
    let (elf_path, _temp) = create_temp_elf().await;

    let app_state = create_standalone_engine(&elf_path).await.unwrap();
    let file_id = elf_path.to_string_lossy().to_string();

    // Engine should be running
    assert!(app_state.engine_manager.has_engine(&file_id));

    // Shutdown
    app_state.engine_manager.shutdown_all().await.unwrap();

    // Engine should be removed
    assert!(
        !app_state.engine_manager.has_engine(&file_id),
        "Engine should be removed after shutdown"
    );
}
