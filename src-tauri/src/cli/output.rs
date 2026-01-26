//! 输出格式化模块
//!
//! 格式化返回给 Agent 的响应

use crate::ipc::protocol::{error_codes, Response};
use serde_json::Value;

/// 格式化成功响应
pub fn format_response(result: Result<Value, String>) -> Response {
    match result {
        Ok(data) => Response::success(data),
        Err(msg) => Response::error(error_codes::INTERNAL_ERROR, msg),
    }
}

/// 格式化 Block 列表响应
pub fn format_block_list(blocks: Vec<Value>) -> Response {
    Response::success(serde_json::json!({
        "blocks": blocks,
        "count": blocks.len()
    }))
}

/// 格式化单个 Block 响应
pub fn format_block(block: Value) -> Response {
    Response::success(block)
}

/// 格式化文件列表响应
pub fn format_file_list(files: Vec<Value>) -> Response {
    Response::success(serde_json::json!({
        "files": files,
        "count": files.len()
    }))
}

/// 格式化执行结果响应
pub fn format_execute_result(events: Vec<Value>) -> Response {
    Response::success(serde_json::json!({
        "status": "success",
        "events": events,
        "events_count": events.len()
    }))
}

/// 格式化项目未打开错误
pub fn format_project_not_open(project: &str) -> Response {
    Response::error(
        error_codes::PROJECT_NOT_OPEN,
        format!("Project {} is not open", project),
    )
}

/// 格式化 Block 未找到错误
pub fn format_block_not_found(block_id: &str) -> Response {
    Response::error(
        error_codes::BLOCK_NOT_FOUND,
        format!("Block {} not found", block_id),
    )
}

/// 格式化无效能力错误
pub fn format_invalid_capability(capability: &str) -> Response {
    Response::error(
        error_codes::INVALID_CAPABILITY,
        format!("Invalid capability: {}", capability),
    )
}

/// 格式化缺少参数错误
pub fn format_missing_parameter(param: &str) -> Response {
    Response::error(
        error_codes::MISSING_PARAMETER,
        format!("Missing required parameter: {}", param),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_response_success() {
        let result = Ok(serde_json::json!({"test": true}));
        let response = format_response(result);

        assert!(response.success);
        assert!(response.data.is_some());
    }

    #[test]
    fn test_format_response_error() {
        let result: Result<Value, String> = Err("Something went wrong".to_string());
        let response = format_response(result);

        assert!(!response.success);
        assert!(response.error.is_some());
    }

    #[test]
    fn test_format_block_list() {
        let blocks = vec![serde_json::json!({"block_id": "123"})];
        let response = format_block_list(blocks);

        assert!(response.success);
        let data = response.data.unwrap();
        assert_eq!(data["count"], 1);
    }
}
