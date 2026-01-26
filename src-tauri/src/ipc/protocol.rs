//! IPC 请求/响应协议定义
//!
//! 定义 Agent 与 Elfiee 通信的数据结构

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// IPC 请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Request {
    /// 要执行的能力 ID（如 "block.list", "markdown.write"）
    pub capability: String,

    /// 项目路径（.elf 文件路径）
    #[serde(default)]
    pub project: Option<String>,

    /// 目标 Block ID（用于 block 级别操作）
    #[serde(default)]
    pub block: Option<String>,

    /// 能力参数
    #[serde(default)]
    pub payload: Value,
}

/// IPC 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    /// 是否成功
    pub success: bool,

    /// 成功时的数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,

    /// 失败时的错误信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorInfo>,
}

/// 错误信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    /// 错误码
    pub code: String,

    /// 错误消息
    pub message: String,

    /// 详细信息（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl Response {
    /// 创建成功响应
    pub fn success(data: Value) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    /// 创建空的成功响应
    pub fn ok() -> Self {
        Self {
            success: true,
            data: None,
            error: None,
        }
    }

    /// 创建错误响应
    pub fn error(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(ErrorInfo {
                code: code.into(),
                message: message.into(),
                details: None,
            }),
        }
    }

    /// 创建带详情的错误响应
    pub fn error_with_details(
        code: impl Into<String>,
        message: impl Into<String>,
        details: Value,
    ) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(ErrorInfo {
                code: code.into(),
                message: message.into(),
                details: Some(details),
            }),
        }
    }
}

/// 错误码常量
pub mod error_codes {
    /// 项目未打开
    pub const PROJECT_NOT_OPEN: &str = "PROJECT_NOT_OPEN";

    /// Block 不存在
    pub const BLOCK_NOT_FOUND: &str = "BLOCK_NOT_FOUND";

    /// 无效的能力
    pub const INVALID_CAPABILITY: &str = "INVALID_CAPABILITY";

    /// 无权限执行
    pub const UNAUTHORIZED: &str = "UNAUTHORIZED";

    /// 参数格式错误
    pub const INVALID_PAYLOAD: &str = "INVALID_PAYLOAD";

    /// 内部错误
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";

    /// 文件不存在
    pub const FILE_NOT_FOUND: &str = "FILE_NOT_FOUND";

    /// 文件已存在
    pub const FILE_ALREADY_EXISTS: &str = "FILE_ALREADY_EXISTS";

    /// 缺少必要参数
    pub const MISSING_PARAMETER: &str = "MISSING_PARAMETER";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_request_serialization() {
        let request = Request {
            capability: "block.list".to_string(),
            project: Some("./test.elf".to_string()),
            block: None,
            payload: serde_json::json!({}),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("block.list"));
        assert!(json.contains("./test.elf"));

        let parsed: Request = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.capability, "block.list");
    }

    #[test]
    fn test_request_deserialization_minimal() {
        // 只有 capability 是必需的
        let json = r#"{"capability":"file.list"}"#;
        let request: Request = serde_json::from_str(json).unwrap();

        assert_eq!(request.capability, "file.list");
        assert!(request.project.is_none());
        assert!(request.block.is_none());
    }

    #[test]
    fn test_response_success() {
        let response = Response::success(serde_json::json!({
            "blocks": []
        }));

        assert!(response.success);
        assert!(response.data.is_some());
        assert!(response.error.is_none());

        let json = serde_json::to_string(&response).unwrap();
        assert!(!json.contains("error"));
    }

    #[test]
    fn test_response_error() {
        let response = Response::error(
            error_codes::PROJECT_NOT_OPEN,
            "Project ./my.elf is not open",
        );

        assert!(!response.success);
        assert!(response.data.is_none());
        assert!(response.error.is_some());

        let error = response.error.unwrap();
        assert_eq!(error.code, "PROJECT_NOT_OPEN");
    }
}
