//! MCP stdio Transport Layer
//!
//! Provides stdin/stdout-based MCP transport for standalone mode.
//! This is the standard MCP transport used when Claude Code launches
//! `elfiee mcp-server --elf {path}` as a subprocess.
//!
//! The JSON-RPC messages are read from stdin and responses written to stdout.

use super::ElfieeMcpServer;
use crate::mcp::dispatcher::run_notification_dispatcher;
use crate::state::AppState;
use rmcp::ServiceExt;
use std::sync::Arc;

/// Start a stdio-based MCP Server.
///
/// This function blocks until the MCP client disconnects (EOF on stdin).
/// Used by the standalone `elfiee mcp-server` command.
///
/// Also spawns a notification dispatcher so the single connected peer
/// receives resource-updated notifications when the engine commits events.
///
/// # Arguments
/// * `server` - The configured ElfieeMcpServer instance
/// * `app_state` - Shared application state (for the dispatcher)
///
/// # Returns
/// * `Ok(())` on clean shutdown
/// * `Err(String)` on initialization failure
pub async fn start_stdio_server(
    server: ElfieeMcpServer,
    app_state: Arc<AppState>,
) -> Result<(), String> {
    // Spawn notification dispatcher for this stdio session
    let dispatcher_rx = app_state.state_change_tx.subscribe();
    let dispatcher_registry = server.peer_registry().clone();
    let dispatcher_state = app_state;
    tokio::spawn(async move {
        run_notification_dispatcher(dispatcher_rx, dispatcher_registry, dispatcher_state).await;
    });

    // Create stdio transport (stdin for reading, stdout for writing)
    let (stdin, stdout) = rmcp::transport::io::stdio();

    // Start serving the MCP server over stdio
    // This will handle the MCP initialization handshake and then process
    // tool calls until the client disconnects
    let service = server
        .serve((stdin, stdout))
        .await
        .map_err(|e| format!("Failed to initialize MCP stdio server: {}", e))?;

    // Wait for the service to complete (client disconnects)
    service
        .waiting()
        .await
        .map_err(|e| format!("MCP stdio server error: {}", e))?;

    Ok(())
}
