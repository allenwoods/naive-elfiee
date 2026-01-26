//! HTTP Server 实现
//!
//! 提供 HTTP API 让外部 AI Agent 与 Elfiee 通信

use crate::cli;
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
///
/// # Arguments
/// * `app_handle` - Tauri 应用句柄
/// * `port` - 监听端口
///
/// # Returns
/// * `Ok(())` - Server 正常关闭
/// * `Err(String)` - 启动失败
pub async fn start_with_handle(app_handle: tauri::AppHandle, port: u16) -> Result<(), String> {
    let server_state = ServerState {
        app_handle,
        registry: Arc::new(AgentRegistry::new()),
    };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/api", post(api_handler))
        .route("/sessions", get(sessions_handler))
        .with_state(server_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    println!("IPC Server starting on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("Server error: {}", e))?;

    Ok(())
}

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

/// 主 API 端点
async fn api_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(request): Json<Request>,
) -> (StatusCode, Json<Response>) {
    // 从 Header 获取 Session ID
    let session_id = headers
        .get("X-Session-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous");

    // 注册/记录 Session 活动
    state.registry.get_or_create(session_id);
    state.registry.record_activity(session_id);

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

    // 通过 AppHandle 获取 AppState
    let app_state = state.get_app_state();

    // 处理请求
    let response = cli::handle_request(&app_state, session_id, parsed).await;

    // 根据响应决定 HTTP 状态码
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

    // 注意：使用 AppHandle 后，测试需要 Tauri 运行时环境
    // 这里保留一个简单的 registry 测试
    #[tokio::test]
    async fn test_registry_creation() {
        let registry = Arc::new(AgentRegistry::new());
        assert_eq!(registry.session_count(), 0);
    }
}
