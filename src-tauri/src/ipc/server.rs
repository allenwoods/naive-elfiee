//! HTTP Server 实现
//!
//! 提供 HTTP API 让外部 AI Agent 与 Elfiee 通信
//!
//! ## API 路由结构
//!
//! ```text
//! GET  /health              - 健康检查
//! GET  /sessions            - 活跃会话列表
//!
//! File 操作:
//! GET  /api/file/list       - 列出已打开的文件
//! POST /api/file/open       - 打开文件
//! POST /api/file/save       - 保存文件
//! POST /api/file/close      - 关闭文件
//!
//! Block 操作:
//! POST /api/block/list      - 列出所有 Block
//! POST /api/block/get       - 获取 Block 详情
//!
//! Capability 操作:
//! POST /api/capability/exec - 执行能力
//! ```

use crate::cli;
use crate::cli::parser::ParsedRequest;
use crate::ipc::protocol::{Request, Response};
use crate::ipc::registry::AgentRegistry;
use crate::state::AppState;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::Manager;

/// 默认端口
pub const DEFAULT_PORT: u16 = 47100;

/// Server 共享状态（使用 AppHandle）
#[derive(Clone)]
pub struct ServerState {
    pub app_handle: tauri::AppHandle,
    pub registry: Arc<AgentRegistry>,
}

impl ServerState {
    /// 获取 AppState 引用
    pub fn get_app_state(&self) -> tauri::State<'_, AppState> {
        self.app_handle.state::<AppState>()
    }
}

/// 启动 IPC Server（使用 Tauri AppHandle）
pub async fn start_with_handle(app_handle: tauri::AppHandle, port: u16) -> Result<(), String> {
    let server_state = ServerState {
        app_handle,
        registry: Arc::new(AgentRegistry::new()),
    };

    // 构建路由
    let file_routes = Router::new()
        .route("/list", get(file_list_handler))
        .route("/open", post(file_open_handler))
        .route("/save", post(file_save_handler))
        .route("/close", post(file_close_handler));

    let block_routes = Router::new()
        .route("/list", post(block_list_handler))
        .route("/get", post(block_get_handler));

    let capability_routes = Router::new().route("/exec", post(capability_exec_handler));

    let api_routes = Router::new()
        .nest("/file", file_routes)
        .nest("/block", block_routes)
        .nest("/capability", capability_routes);

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/sessions", get(sessions_handler))
        .nest("/api", api_routes)
        .with_state(server_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    println!("IPC Server starting on http://{}", addr);
    println!("  Routes:");
    println!("    GET  /health");
    println!("    GET  /sessions");
    println!("    GET  /api/file/list");
    println!("    POST /api/file/open");
    println!("    POST /api/file/save");
    println!("    POST /api/file/close");
    println!("    POST /api/block/list");
    println!("    POST /api/block/get");
    println!("    POST /api/capability/exec");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("Server error: {}", e))?;

    Ok(())
}

// ============================================================================
// 通用处理函数
// ============================================================================

/// 从 Header 提取 Session ID
fn extract_session_id(headers: &HeaderMap) -> &str {
    headers
        .get("X-Session-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous")
}

/// 记录 Session 活动
fn record_session(registry: &AgentRegistry, session_id: &str) {
    registry.get_or_create(session_id);
    registry.record_activity(session_id);
}

// ============================================================================
// 系统端点
// ============================================================================

/// 健康检查端点
async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "elfiee-ipc",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

/// 列出活跃的 Agent Session
async fn sessions_handler(State(state): State<ServerState>) -> Json<serde_json::Value> {
    let sessions = state.registry.list_sessions();

    Json(serde_json::json!({
        "sessions": sessions,
        "count": sessions.len()
    }))
}

// ============================================================================
// File 端点
// ============================================================================

/// GET /api/file/list - 列出已打开的文件
async fn file_list_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
) -> (StatusCode, Json<Response>) {
    let session_id = extract_session_id(&headers);
    record_session(&state.registry, session_id);

    let app_state = state.get_app_state();
    let parsed = ParsedRequest {
        capability: "file.list".to_string(),
        project: None,
        block_id: None,
        payload: serde_json::Value::Null,
    };

    let response = cli::handle_request(&app_state, session_id, parsed).await;
    let status = if response.success {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };

    (status, Json(response))
}

/// POST /api/file/open - 打开文件
async fn file_open_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(request): Json<Request>,
) -> (StatusCode, Json<Response>) {
    let session_id = extract_session_id(&headers);
    record_session(&state.registry, session_id);

    let app_state = state.get_app_state();
    let parsed = ParsedRequest {
        capability: "file.open".to_string(),
        project: request.project,
        block_id: None,
        payload: request.payload,
    };

    let response = cli::handle_request(&app_state, session_id, parsed).await;
    let status = if response.success {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };

    (status, Json(response))
}

/// POST /api/file/save - 保存文件
async fn file_save_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(request): Json<Request>,
) -> (StatusCode, Json<Response>) {
    let session_id = extract_session_id(&headers);
    record_session(&state.registry, session_id);

    let app_state = state.get_app_state();
    let parsed = ParsedRequest {
        capability: "file.save".to_string(),
        project: request.project,
        block_id: None,
        payload: request.payload,
    };

    let response = cli::handle_request(&app_state, session_id, parsed).await;
    let status = if response.success {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };

    (status, Json(response))
}

/// POST /api/file/close - 关闭文件
async fn file_close_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(request): Json<Request>,
) -> (StatusCode, Json<Response>) {
    let session_id = extract_session_id(&headers);
    record_session(&state.registry, session_id);

    let app_state = state.get_app_state();
    let parsed = ParsedRequest {
        capability: "file.close".to_string(),
        project: request.project,
        block_id: None,
        payload: request.payload,
    };

    let response = cli::handle_request(&app_state, session_id, parsed).await;
    let status = if response.success {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };

    (status, Json(response))
}

// ============================================================================
// Block 端点
// ============================================================================

/// POST /api/block/list - 列出所有 Block
async fn block_list_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(request): Json<Request>,
) -> (StatusCode, Json<Response>) {
    let session_id = extract_session_id(&headers);
    record_session(&state.registry, session_id);

    let app_state = state.get_app_state();
    let parsed = ParsedRequest {
        capability: "block.list".to_string(),
        project: request.project,
        block_id: None,
        payload: request.payload,
    };

    let response = cli::handle_request(&app_state, session_id, parsed).await;
    let status = if response.success {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };

    (status, Json(response))
}

/// POST /api/block/get - 获取 Block 详情
async fn block_get_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(request): Json<Request>,
) -> (StatusCode, Json<Response>) {
    let session_id = extract_session_id(&headers);
    record_session(&state.registry, session_id);

    let app_state = state.get_app_state();
    let parsed = ParsedRequest {
        capability: "block.get".to_string(),
        project: request.project,
        block_id: request.block,
        payload: request.payload,
    };

    let response = cli::handle_request(&app_state, session_id, parsed).await;
    let status = if response.success {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };

    (status, Json(response))
}

// ============================================================================
// Capability 端点
// ============================================================================

/// POST /api/capability/exec - 执行能力
async fn capability_exec_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(request): Json<Request>,
) -> (StatusCode, Json<Response>) {
    let session_id = extract_session_id(&headers);
    record_session(&state.registry, session_id);

    // 解析请求
    let parsed = match cli::parse_request(&request) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(Response::error("INVALID_REQUEST", e)),
            );
        }
    };

    let app_state = state.get_app_state();
    let response = cli::handle_request(&app_state, session_id, parsed).await;

    let status = if response.success {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };

    (status, Json(response))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_registry_creation() {
        let registry = Arc::new(AgentRegistry::new());
        assert_eq!(registry.session_count(), 0);
    }
}
