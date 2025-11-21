use crate::engine::EngineHandle;
use crate::models::{Command, Event};
use crate::state::AppState;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// File Sync Engine Wrapper
///
/// 装饰器模式实现文件同步功能，包装原始引擎句柄而不修改核心功能。
/// 这样可以保持引擎核心代码的纯净，同时独立添加文件同步能力。
pub struct FileSyncEngineWrapper {
    /// 原始引擎句柄
    inner: EngineHandle,
    /// 文件ID
    file_id: String,
    /// 应用状态
    state: Arc<AppState>,
    /// Tauri应用句柄（用于发送事件）
    app: Option<AppHandle>,
}

impl FileSyncEngineWrapper {
    /// 创建新的文件同步引擎包装器
    pub fn new(inner: EngineHandle, file_id: String, state: Arc<AppState>) -> Self {
        Self {
            inner,
            file_id,
            state,
            app: None,
        }
    }

    /// 创建带Tauri应用句柄的包装器（可发送事件到前端）
    pub fn with_app(mut self, app: AppHandle) -> Self {
        self.app = Some(app);
        self
    }

    /// 执行命令并自动处理文件同步
    ///
    /// 这是装饰器的核心方法，它：
    /// 1. 调用原始引擎执行命令
    /// 2. 检查返回的事件是否需要文件同步
    /// 3. 如果需要，触发文件同步操作
    pub async fn process_command_with_sync(&self, cmd: Command) -> Result<Vec<Event>, String> {
        // 1. 调用原始引擎执行命令（保持核心功能不变）
        let events = self.inner.process_command(cmd).await?;

        // 2. 检查是否需要文件同步
        if self.should_sync(&events) {
            self.sync_file(&events).await;
        }

        Ok(events)
    }

    /// 透传其他引擎方法，保持完整的EngineHandle接口

    /// 获取块
    pub async fn get_block(&self, block_id: String) -> Option<crate::models::Block> {
        self.inner.get_block(block_id).await
    }

    /// 获取所有块
    pub async fn get_all_blocks(&self) -> std::collections::HashMap<String, crate::models::Block> {
        self.inner.get_all_blocks().await
    }

    /// 检查事件是否需要文件同步
    ///
    /// 扫描事件列表，查找包含 `needs_file_sync: true` 标志的事件
    fn should_sync(&self, events: &[Event]) -> bool {
        events.iter().any(|event| {
            if let Some(contents) = event.value.get("contents") {
                if let Some(obj) = contents.as_object() {
                    return obj
                        .get("needs_file_sync")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
            false
        })
    }

    /// 执行文件同步操作
    ///
    /// 实际保存文件到磁盘，并发送事件到前端通知同步状态
    async fn sync_file(&self, events: &[Event]) {
        // 提取命令信息用于日志和事件
        let command = self.extract_command_info(events);

        // 获取文件信息
        let file_info = match self.state.files.get(&self.file_id) {
            Some(info) => info,
            None => {
                eprintln!("File sync failed: File '{}' not found", self.file_id);
                self.emit_sync_error(&command, "文件未找到").await;
                return;
            }
        };

        let archive = file_info.archive.clone();
        let elf_path = file_info.path.clone();

        // 获取文件保存互斥锁（防止并发保存同一文件）
        let save_mutex = self.state.get_file_save_mutex(&self.file_id);

        // 克隆必要数据用于异步任务
        let app_handle = self.app.clone();
        let file_id_clone = self.file_id.clone();

        // 异步执行文件同步（不阻塞命令处理）
        tokio::spawn(async move {
            let _guard = save_mutex.lock().await;

            match archive.save(&elf_path) {
                Ok(_) => {
                    println!("File sync completed successfully for command: {}", command);

                    // 发送成功事件到前端
                    if let Some(app) = app_handle {
                        if let Err(e) = app.emit(
                            "file-sync-success",
                            serde_json::json!({
                                "command": command,
                                "file_id": file_id_clone
                            }),
                        ) {
                            eprintln!("Failed to emit file-sync-success event: {}", e);
                        }
                    }
                }
                Err(e) => {
                    let error_msg = format!("文件同步失败: {}", e);
                    eprintln!("File sync failed: {}", e);

                    // 发送错误事件到前端
                    if let Some(app) = app_handle {
                        if let Err(emit_err) = app.emit(
                            "file-sync-error",
                            serde_json::json!({
                                "command": command,
                                "error": error_msg,
                                "file_id": file_id_clone
                            }),
                        ) {
                            eprintln!("Failed to emit file-sync-error event: {}", emit_err);
                        }
                    }
                }
            }
        });
    }

    /// 从事件中提取命令信息
    fn extract_command_info(&self, events: &[Event]) -> String {
        events
            .iter()
            .find_map(|event| {
                event
                    .value
                    .get("contents")
                    .and_then(|contents| contents.as_object())
                    .and_then(|obj| obj.get("file_operation_command"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "unknown".to_string())
    }

    /// 发送同步错误事件到前端
    async fn emit_sync_error(&self, command: &str, error: &str) {
        if let Some(app) = &self.app {
            if let Err(e) = app.emit(
                "file-sync-error",
                serde_json::json!({
                    "command": command,
                    "error": error,
                    "file_id": self.file_id
                }),
            ) {
                eprintln!("Failed to emit file-sync-error event: {}", e);
            }
        }
    }
}

/// 文件同步服务
///
/// 高级接口，提供便捷的包装器创建方法
pub struct FileSyncService;

impl FileSyncService {
    /// 包装现有的引擎句柄，添加文件同步能力
    pub fn wrap_engine(
        engine: EngineHandle,
        file_id: String,
        state: Arc<AppState>,
    ) -> FileSyncEngineWrapper {
        FileSyncEngineWrapper::new(engine, file_id, state)
    }

    /// 包装引擎并添加Tauri应用句柄
    pub fn wrap_engine_with_app(
        engine: EngineHandle,
        file_id: String,
        state: Arc<AppState>,
        app: AppHandle,
    ) -> FileSyncEngineWrapper {
        FileSyncEngineWrapper::new(engine, file_id, state).with_app(app)
    }
}

#[cfg(test)]
mod tests {
    use crate::models::Event;
    use std::collections::HashMap;

    fn create_test_event(needs_sync: bool) -> Event {
        let mut timestamp = HashMap::new();
        timestamp.insert("test_editor".to_string(), 1);

        Event::new(
            "test_block".to_string(),
            "test_editor/test.capability".to_string(),
            serde_json::json!({
                "contents": {
                    "needs_file_sync": needs_sync,
                    "file_operation_command": "test_command"
                }
            }),
            timestamp,
        )
    }

    #[test]
    fn test_should_sync_with_flag() {
        // 模拟引擎和状态（实际测试中需要更完整的设置）
        let events = vec![create_test_event(true)];

        // 测试should_sync逻辑的核心部分
        let should_sync = events.iter().any(|event| {
            if let Some(contents) = event.value.get("contents") {
                if let Some(obj) = contents.as_object() {
                    return obj
                        .get("needs_file_sync")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
            false
        });

        assert!(should_sync, "Events with needs_file_sync=true should trigger sync");
    }

    #[test]
    fn test_should_not_sync_without_flag() {
        let events = vec![create_test_event(false)];

        let should_sync = events.iter().any(|event| {
            if let Some(contents) = event.value.get("contents") {
                if let Some(obj) = contents.as_object() {
                    return obj
                        .get("needs_file_sync")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
            false
        });

        assert!(!should_sync, "Events with needs_file_sync=false should not trigger sync");
    }

    #[test]
    fn test_extract_command_info() {
        let events = vec![create_test_event(true)];

        let command = events
            .iter()
            .find_map(|event| {
                event
                    .value
                    .get("contents")
                    .and_then(|contents| contents.as_object())
                    .and_then(|obj| obj.get("file_operation_command"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "unknown".to_string());

        assert_eq!(command, "test_command", "Should extract correct command info");
    }
}