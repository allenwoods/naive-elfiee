//! CLI 模块 - Agent 请求处理
//!
//! 处理来自 Claude Code、Gemini CLI 等 AI Agent 的请求

pub mod handler;
pub mod output;
pub mod parser;

pub use handler::handle_request;
pub use output::format_response;
pub use parser::parse_request;
