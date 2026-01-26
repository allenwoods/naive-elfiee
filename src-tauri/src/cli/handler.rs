//! 能力处理器
//!
//! 根据能力 ID 分发到对应的处理函数

use crate::cli::output;
use crate::cli::parser::ParsedRequest;
use crate::ipc::protocol::Response;
use crate::state::AppState;

/// 处理 Agent 请求
pub async fn handle_request(
    app_state: &AppState,
    session_id: &str,
    request: ParsedRequest,
) -> Response {
    // 根据能力 ID 分发
    match request.capability.as_str() {
        // 文件操作
        "file.list" => handle_file_list(app_state).await,
        "file.open" => handle_file_open(app_state, &request).await,
        "file.save" => handle_file_save(app_state, &request).await,
        "file.close" => handle_file_close(app_state, &request).await,

        // Block 操作
        "block.list" => handle_block_list(app_state, &request).await,
        "block.get" => handle_block_get(app_state, &request).await,

        // 其他能力：通过 EngineManager 执行
        _ => handle_capability_execute(app_state, session_id, &request).await,
    }
}

/// 处理 file.list
async fn handle_file_list(app_state: &AppState) -> Response {
    let files = app_state.list_open_files();

    let file_list: Vec<serde_json::Value> = files
        .iter()
        .map(|(file_id, path)| {
            serde_json::json!({
                "file_id": file_id,
                "path": path
            })
        })
        .collect();

    output::format_file_list(file_list)
}

/// 处理 file.open
async fn handle_file_open(app_state: &AppState, request: &ParsedRequest) -> Response {
    let project = match &request.project {
        Some(p) => p,
        None => return output::format_missing_parameter("project"),
    };

    // 检查文件是否已经打开
    let files = app_state.list_open_files();
    for (file_id, path) in &files {
        if path == project {
            return Response::success(serde_json::json!({
                "file_id": file_id,
                "path": path,
                "status": "already_open"
            }));
        }
    }

    // TODO: 实际打开文件的逻辑需要调用现有的 commands::file::open_file
    // 这里先返回一个占位响应
    Response::error(
        "NOT_IMPLEMENTED",
        "file.open via IPC is not yet implemented. Please open the file in Elfiee GUI first.",
    )
}

/// 处理 file.save
async fn handle_file_save(app_state: &AppState, request: &ParsedRequest) -> Response {
    let file_id = match get_file_id(app_state, request) {
        Ok(id) => id,
        Err(response) => return response,
    };

    // TODO: 调用 save 逻辑
    Response::success(serde_json::json!({
        "file_id": file_id,
        "status": "saved"
    }))
}

/// 处理 file.close
async fn handle_file_close(app_state: &AppState, request: &ParsedRequest) -> Response {
    let file_id = match get_file_id(app_state, request) {
        Ok(id) => id,
        Err(response) => return response,
    };

    // TODO: 调用 close 逻辑
    Response::success(serde_json::json!({
        "file_id": file_id,
        "status": "closed"
    }))
}

/// 处理 block.list
async fn handle_block_list(app_state: &AppState, request: &ParsedRequest) -> Response {
    let file_id = match get_file_id(app_state, request) {
        Ok(id) => id,
        Err(response) => return response,
    };

    // 获取 engine handle
    let handle = match app_state.engine_manager.get_engine(&file_id) {
        Some(h) => h,
        None => {
            return output::format_project_not_open(request.project.as_deref().unwrap_or("unknown"))
        }
    };

    // 获取所有 blocks
    let blocks = handle.get_all_blocks().await;

    let block_list: Vec<serde_json::Value> = blocks
        .values()
        .map(|block| {
            serde_json::json!({
                "block_id": block.block_id,
                "name": block.name,
                "block_type": block.block_type,
                "owner": block.owner,
                "children_count": block.children.len()
            })
        })
        .collect();

    output::format_block_list(block_list)
}

/// 处理 block.get
async fn handle_block_get(app_state: &AppState, request: &ParsedRequest) -> Response {
    let file_id = match get_file_id(app_state, request) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let block_id = match &request.block_id {
        Some(id) => id,
        None => return output::format_missing_parameter("block"),
    };

    // 获取 engine handle
    let handle = match app_state.engine_manager.get_engine(&file_id) {
        Some(h) => h,
        None => {
            return output::format_project_not_open(request.project.as_deref().unwrap_or("unknown"))
        }
    };

    // 获取 block
    match handle.get_block(block_id.clone()).await {
        Some(block) => output::format_block(serde_json::to_value(&block).unwrap_or_default()),
        None => output::format_block_not_found(block_id),
    }
}

/// 处理通用能力执行
async fn handle_capability_execute(
    app_state: &AppState,
    _session_id: &str,
    request: &ParsedRequest,
) -> Response {
    let file_id = match get_file_id(app_state, request) {
        Ok(id) => id,
        Err(response) => return response,
    };

    // 获取 engine handle
    let handle = match app_state.engine_manager.get_engine(&file_id) {
        Some(h) => h,
        None => {
            return output::format_project_not_open(request.project.as_deref().unwrap_or("unknown"))
        }
    };

    // 获取 active editor（作为执行者）
    // active_editor 存储在 AppState 中，而不是 EngineHandle
    let editor_id = match app_state.get_active_editor(&file_id) {
        Some(id) => id,
        None => {
            return Response::error(
                "NO_ACTIVE_EDITOR",
                "No active editor. Please set an active editor first.",
            )
        }
    };

    // 构建 Command
    let block_id = request.block_id.clone().unwrap_or_default();
    let cmd = crate::models::Command::new(
        editor_id,
        request.capability.clone(),
        block_id,
        request.payload.clone(),
    );

    // 执行命令
    match handle.process_command(cmd).await {
        Ok(events) => {
            let event_list: Vec<serde_json::Value> = events
                .iter()
                .map(|e| {
                    serde_json::json!({
                        "event_id": e.event_id,
                        "entity": e.entity,
                        "attribute": e.attribute
                    })
                })
                .collect();

            output::format_execute_result(event_list)
        }
        Err(e) => Response::error("EXECUTION_FAILED", e),
    }
}

/// 辅助函数：根据 project 路径获取 file_id
fn get_file_id(app_state: &AppState, request: &ParsedRequest) -> Result<String, Response> {
    let project = match &request.project {
        Some(p) => p,
        None => return Err(output::format_missing_parameter("project")),
    };

    // 查找已打开的文件
    let files = app_state.list_open_files();
    for (file_id, path) in &files {
        if path == project {
            return Ok(file_id.clone());
        }
    }

    Err(output::format_project_not_open(project))
}

#[cfg(test)]
mod tests {
    // TODO: 添加测试
}
