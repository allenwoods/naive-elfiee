//! Agent Session 注册表
//!
//! 管理连接到 Elfiee 的 AI Agent Session

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};

/// Agent Session 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSession {
    /// Session ID
    pub session_id: String,

    /// Agent 类型（如 "claude", "gemini"）
    pub agent_type: Option<String>,

    /// 连接时间
    pub connected_at: DateTime<Utc>,

    /// 最后活跃时间
    pub last_activity: DateTime<Utc>,

    /// 请求计数
    pub request_count: u64,
}

impl AgentSession {
    /// 创建新的 Session
    pub fn new(session_id: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            session_id: session_id.into(),
            agent_type: None,
            connected_at: now,
            last_activity: now,
            request_count: 0,
        }
    }

    /// 记录一次活动
    pub fn record_activity(&mut self) {
        self.last_activity = Utc::now();
        self.request_count += 1;
    }
}

/// Agent 注册表
#[derive(Debug, Default)]
pub struct AgentRegistry {
    sessions: DashMap<String, AgentSession>,
}

impl AgentRegistry {
    /// 创建新的注册表
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
        }
    }

    /// 获取或创建 Session
    pub fn get_or_create(&self, session_id: &str) -> AgentSession {
        self.sessions
            .entry(session_id.to_string())
            .or_insert_with(|| AgentSession::new(session_id))
            .clone()
    }

    /// 记录 Session 活动
    pub fn record_activity(&self, session_id: &str) {
        if let Some(mut session) = self.sessions.get_mut(session_id) {
            session.record_activity();
        }
    }

    /// 获取所有活跃的 Session
    pub fn list_sessions(&self) -> Vec<AgentSession> {
        self.sessions.iter().map(|r| r.value().clone()).collect()
    }

    /// 获取 Session 数量
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }

    /// 移除 Session
    pub fn remove(&self, session_id: &str) -> Option<AgentSession> {
        self.sessions.remove(session_id).map(|(_, v)| v)
    }

    /// 清理过期的 Session（超过指定分钟数未活动）
    pub fn cleanup_inactive(&self, inactive_minutes: i64) {
        let cutoff = Utc::now() - chrono::Duration::minutes(inactive_minutes);
        self.sessions
            .retain(|_, session| session.last_activity > cutoff);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_session_new() {
        let session = AgentSession::new("test-session");
        assert_eq!(session.session_id, "test-session");
        assert_eq!(session.request_count, 0);
        assert!(session.agent_type.is_none());
    }

    #[test]
    fn test_agent_session_record_activity() {
        let mut session = AgentSession::new("test-session");
        let initial_time = session.last_activity;

        std::thread::sleep(std::time::Duration::from_millis(10));
        session.record_activity();

        assert_eq!(session.request_count, 1);
        assert!(session.last_activity >= initial_time);
    }

    #[test]
    fn test_registry_get_or_create() {
        let registry = AgentRegistry::new();

        let session1 = registry.get_or_create("session-1");
        assert_eq!(session1.session_id, "session-1");

        // 再次获取应该返回同一个 session
        let session1_again = registry.get_or_create("session-1");
        assert_eq!(session1_again.session_id, "session-1");

        assert_eq!(registry.session_count(), 1);
    }

    #[test]
    fn test_registry_list_sessions() {
        let registry = AgentRegistry::new();

        registry.get_or_create("session-1");
        registry.get_or_create("session-2");

        let sessions = registry.list_sessions();
        assert_eq!(sessions.len(), 2);
    }

    #[test]
    fn test_registry_record_activity() {
        let registry = AgentRegistry::new();
        registry.get_or_create("session-1");

        registry.record_activity("session-1");
        registry.record_activity("session-1");

        let session = registry.get_or_create("session-1");
        assert_eq!(session.request_count, 2);
    }
}
