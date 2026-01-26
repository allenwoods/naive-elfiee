//! IPC 模块
//!
//! 提供 HTTP Server 让外部 AI Agent 与 Elfiee 通信

pub mod protocol;
pub mod registry;
pub mod server;

pub use protocol::{Request, Response};
pub use registry::{AgentRegistry, AgentSession};
