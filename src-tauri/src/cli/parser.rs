//! 请求解析模块
//!
//! 解析 Agent 发来的请求

use crate::ipc::protocol::Request;
use serde_json::Value;

/// 解析后的请求
#[derive(Debug, Clone)]
pub struct ParsedRequest {
    /// 项目路径
    pub project: Option<String>,

    /// 能力 ID
    pub capability: String,

    /// 目标 Block ID
    pub block_id: Option<String>,

    /// 能力参数
    pub payload: Value,
}

/// 解析请求
pub fn parse_request(request: &Request) -> Result<ParsedRequest, String> {
    // 验证 capability 非空
    if request.capability.is_empty() {
        return Err("capability is required".to_string());
    }

    Ok(ParsedRequest {
        project: request.project.clone(),
        capability: request.capability.clone(),
        block_id: request.block.clone(),
        payload: request.payload.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_request_success() {
        let request = Request {
            capability: "block.list".to_string(),
            project: Some("./test.elf".to_string()),
            block: None,
            payload: serde_json::json!({}),
        };

        let parsed = parse_request(&request).unwrap();
        assert_eq!(parsed.capability, "block.list");
        assert_eq!(parsed.project, Some("./test.elf".to_string()));
    }

    #[test]
    fn test_parse_request_empty_capability() {
        let request = Request {
            capability: "".to_string(),
            project: None,
            block: None,
            payload: serde_json::json!({}),
        };

        let result = parse_request(&request);
        assert!(result.is_err());
    }
}
