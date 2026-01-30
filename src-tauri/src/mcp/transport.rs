//! MCP Transport Layer
//!
//! Provides an independent SSE server for MCP protocol communication.
//! The MCP server runs on its own port (47200), separate from the Tauri app.

use super::ElfieeMcpServer;
use crate::mcp::dispatcher::run_notification_dispatcher;
use crate::mcp::peer_registry::PeerRegistry;
use crate::state::AppState;
use rmcp::transport::sse_server::{SseServer, SseServerConfig};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// MCP SSE Server default port
pub const MCP_PORT: u16 = 47200;

/// Start an independent MCP SSE Server.
///
/// Called during Tauri setup as a background task.
/// The MCP server shares AppState with the GUI (same process).
///
/// This also spawns a notification dispatcher that bridges engine state changes
/// to MCP resource-updated notifications for connected peers.
pub async fn start_mcp_server(app_state: Arc<AppState>, port: u16) -> Result<(), String> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    let config = SseServerConfig {
        bind: addr,
        sse_path: "/sse".to_string(),
        post_path: "/message".to_string(),
        ct: CancellationToken::new(),
        sse_keep_alive: Some(Duration::from_secs(30)),
    };

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("MCP: Failed to bind to port {}: {}", port, e))?;

    println!("MCP Server listening on http://{}", addr);
    println!("  GET  /sse      - SSE connection");
    println!("  POST /message  - MCP messages");

    // Create shared peer registry for tracking connected MCP clients
    let registry = PeerRegistry::new();

    // Spawn notification dispatcher: bridges engine broadcast → MCP peer notifications
    let dispatcher_rx = app_state.state_change_tx.subscribe();
    let dispatcher_registry = registry.clone();
    let dispatcher_state = app_state.clone();
    tokio::spawn(async move {
        run_notification_dispatcher(dispatcher_rx, dispatcher_registry, dispatcher_state).await;
    });

    let (sse_server, router) = SseServer::new(config);

    // Register MCP service: each connection gets a new ElfieeMcpServer instance
    // (shared AppState and PeerRegistry)
    let _ct =
        sse_server.with_service(move || ElfieeMcpServer::new(app_state.clone(), registry.clone()));

    axum::serve(listener, router)
        .await
        .map_err(|e| format!("MCP Server error: {}", e))?;

    Ok(())
}
