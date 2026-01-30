//! Standalone Engine for MCP Server
//!
//! Creates an independent Engine instance that can operate without the GUI.
//! Used by `elfiee mcp-server --elf {path}` to run MCP as a standalone process.
//!
//! Key differences from GUI mode:
//! - Opens .elf file directly (not managed by Tauri)
//! - Enables SQLite WAL mode for concurrent writes
//! - Auto-creates a default "mcp-agent" editor with full permissions
//! - Returns an AppState that the MCP server can use

use crate::elf::ElfArchive;
use crate::engine::{EventPoolWithPath, EventStore};
use crate::models::Command;
use crate::state::{AppState, FileInfo};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;

/// Default editor ID for standalone MCP server
pub const MCP_EDITOR_ID: &str = "mcp-agent";

/// Default editor display name
pub const MCP_EDITOR_NAME: &str = "MCP Agent";

/// Create a standalone Engine for the MCP server.
///
/// This function:
/// 1. Opens the .elf file (extracts ZIP to temp directory)
/// 2. Creates an EventStore with WAL mode enabled
/// 3. Spawns an Engine actor
/// 4. Creates a default "mcp-agent" editor with full permissions
/// 5. Returns an AppState ready for MCP server use
///
/// # Arguments
/// * `elf_path` - Path to the .elf file to open
///
/// # Returns
/// * `Arc<AppState>` - Shared application state for the MCP server
pub async fn create_standalone_engine(elf_path: &Path) -> Result<Arc<AppState>, String> {
    // 1. Open .elf file (extract to temp directory)
    let archive = ElfArchive::open(elf_path)
        .map_err(|e| format!("Failed to open .elf file '{}': {}", elf_path.display(), e))?;

    // 2. Create EventStore with WAL mode
    let event_pool = create_wal_event_pool(&archive).await?;

    // 3. Create AppState
    let app_state = AppState::new();

    // 4. Register the file
    let file_id = elf_path.to_string_lossy().to_string();
    app_state.files.insert(
        file_id.clone(),
        FileInfo {
            archive: Arc::new(archive),
            path: PathBuf::from(elf_path),
        },
    );

    // 5. Spawn engine actor (with state change notifications)
    app_state
        .engine_manager
        .spawn_engine(
            file_id.clone(),
            event_pool,
            Some(app_state.state_change_tx.clone()),
        )
        .await
        .map_err(|e| format!("Failed to spawn engine: {}", e))?;

    // 6. Create default MCP editor and set as active
    create_mcp_editor(&app_state, &file_id).await?;

    let state = Arc::new(app_state);
    Ok(state)
}

/// Create an EventStore with WAL mode enabled.
///
/// WAL (Write-Ahead Logging) mode allows multiple processes to read/write
/// the same SQLite database concurrently. This is essential when both
/// the GUI and standalone MCP server access the same .elf file.
///
/// WAL mode is set via `SqliteConnectOptions::journal_mode()` so that
/// every connection from the pool uses WAL consistently (not via a
/// one-shot PRAGMA which can be overridden by the pool).
async fn create_wal_event_pool(archive: &ElfArchive) -> Result<EventPoolWithPath, String> {
    let db_path = archive.temp_path().join("events.db");
    let db_path_str = db_path
        .to_str()
        .ok_or_else(|| "Invalid database path encoding".to_string())?;

    let connection_string = format!("sqlite://{}", db_path_str);

    // Create pool with WAL mode set in connect options
    // This ensures every connection uses WAL, unlike a post-hoc PRAGMA
    let connect_opts = SqliteConnectOptions::from_str(&connection_string)
        .map_err(|e| format!("Invalid database path: {}", e))?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_opts)
        .await
        .map_err(|e| format!("Failed to connect to event store: {}", e))?;

    // Initialize the event store schema
    EventStore::init_schema(&pool)
        .await
        .map_err(|e| format!("Failed to initialize event store schema: {}", e))?;

    Ok(EventPoolWithPath { pool, db_path })
}

/// Create the default MCP editor and set it as active.
///
/// The MCP editor is auto-created with an "editor.create" command,
/// then set as the active editor so all MCP tool calls use it.
async fn create_mcp_editor(app_state: &AppState, file_id: &str) -> Result<(), String> {
    let handle = app_state
        .engine_manager
        .get_engine(file_id)
        .ok_or_else(|| format!("Engine not found for file: {}", file_id))?;

    // Check if the editor already exists (e.g., from a previous session)
    let editors = handle.get_all_editors().await;
    if !editors.contains_key(MCP_EDITOR_ID) {
        // Create the MCP editor using core.create capability
        // Note: editor.create is a system-level command that doesn't require an existing editor
        let cmd = Command::new(
            MCP_EDITOR_ID.to_string(),
            "editor.create".to_string(),
            String::new(),
            serde_json::json!({
                "editor_id": MCP_EDITOR_ID,
                "name": MCP_EDITOR_NAME
            }),
        );

        handle
            .process_command(cmd)
            .await
            .map_err(|e| format!("Failed to create MCP editor: {}", e))?;
    }

    // Set as active editor for this file
    app_state.set_active_editor(file_id.to_string(), MCP_EDITOR_ID.to_string());

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_create_standalone_engine() {
        // Create a temporary .elf file
        let archive = ElfArchive::new().await.unwrap();
        let temp_file = NamedTempFile::new().unwrap();
        let elf_path = temp_file.path().with_extension("elf");
        archive.save(&elf_path).unwrap();

        // Create standalone engine
        let app_state = create_standalone_engine(&elf_path).await.unwrap();

        // Verify file is registered
        let files = app_state.list_open_files();
        assert_eq!(files.len(), 1);

        // Verify engine is running
        let file_id = &files[0].0;
        assert!(app_state.engine_manager.has_engine(file_id));

        // Verify active editor is set
        let editor = app_state.get_active_editor(file_id);
        assert_eq!(editor, Some(MCP_EDITOR_ID.to_string()));

        // Verify MCP editor was created
        let handle = app_state.engine_manager.get_engine(file_id).unwrap();
        let editors = handle.get_all_editors().await;
        assert!(editors.contains_key(MCP_EDITOR_ID));
    }

    #[tokio::test]
    async fn test_wal_mode_enabled() {
        // Create a temp .elf file
        let archive = ElfArchive::new().await.unwrap();
        let event_pool = create_wal_event_pool(&archive).await.unwrap();

        // Verify WAL mode by querying journal_mode
        let row: (String,) = sqlx::query_as("PRAGMA journal_mode")
            .fetch_one(&event_pool.pool)
            .await
            .unwrap();

        assert_eq!(row.0.to_lowercase(), "wal");
    }
}
