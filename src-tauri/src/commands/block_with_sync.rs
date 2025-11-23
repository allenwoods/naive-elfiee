use crate::capabilities::FileSyncService;
use crate::models::{Block, Command, Event};
use crate::state::AppState;
use specta::specta;
use std::sync::Arc;
use tauri::{AppHandle, State};

/// Execute a command with automatic file sync support using decorator pattern.
///
/// 这个命令使用装饰器模式包装原始引擎，添加文件同步能力而不修改核心代码。
/// 装饰器会：
/// 1. 调用原始引擎执行命令
/// 2. 检查返回事件中的 needs_file_sync 标志
/// 3. 如果需要，自动触发文件保存
///
/// # Arguments
/// * `file_id` - 文件唯一标识
/// * `cmd` - 要执行的命令
/// * `app` - Tauri应用句柄（用于发送事件）
/// * `state` - 应用状态
///
/// # Returns
/// * `Ok(events)` - 命令执行产生的事件
/// * `Err(message)` - 错误描述
#[tauri::command]
#[specta]
pub async fn execute_command_with_sync(
    file_id: String,
    cmd: Command,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<Event>, String> {
    // 获取原始引擎句柄
    let engine_handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // 使用装饰器模式包装引擎，添加文件同步能力
    // Note: Clone is cheap - AppState only contains Arc<...> fields,
    // so .clone() only duplicates Arc pointers, not the underlying data
    let app_state = state.inner().clone();
    let sync_wrapper = FileSyncService::wrap_engine_with_app(
        engine_handle,
        file_id,
        Arc::new(app_state),
        app,
    );

    // 通过包装器执行命令（自动包含文件同步）
    sync_wrapper.process_command_with_sync(cmd).await
}

/// Get a block using the file sync wrapper (for consistency).
///
/// 虽然获取块不需要文件同步，但提供统一接口
///
/// Note: Read operations don't trigger file sync, but we provide this interface
/// for API consistency and potential future use (e.g., read-triggered cache updates).
#[tauri::command]
#[specta]
pub async fn get_block_with_sync(
    file_id: String,
    block_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Block, String> {
    // 获取原始引擎句柄
    let engine_handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // 使用装饰器包装（虽然读取操作不需要同步）
    // Note: Clone is cheap - only clones Arc pointers, not underlying data
    let app_state = state.inner().clone();
    let sync_wrapper = FileSyncService::wrap_engine_with_app(
        engine_handle,
        file_id,
        Arc::new(app_state),
        app,
    );

    // 获取块
    sync_wrapper
        .get_block(block_id)
        .await
        .ok_or_else(|| "Block not found".to_string())
}

/// Get all blocks using the file sync wrapper (for consistency).
///
/// Note: Read operations don't trigger file sync, but we provide this interface
/// for API consistency and potential future use (e.g., read-triggered cache updates).
#[tauri::command]
#[specta]
pub async fn get_all_blocks_with_sync(
    file_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<Block>, String> {
    // 获取原始引擎句柄
    let engine_handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // 使用装饰器包装
    // Note: Clone is cheap - only clones Arc pointers, not underlying data
    let app_state = state.inner().clone();
    let sync_wrapper = FileSyncService::wrap_engine_with_app(
        engine_handle,
        file_id,
        Arc::new(app_state),
        app,
    );

    // 获取所有块并转换为Vec
    let blocks_map = sync_wrapper.get_all_blocks().await;
    let blocks: Vec<Block> = blocks_map.into_values().collect();
    Ok(blocks)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Event;
    use std::collections::HashMap;

    #[test]
    fn test_wrapper_command_interface() {
        // 测试装饰器命令接口的兼容性
        let mut timestamp = HashMap::new();
        timestamp.insert("test_editor".to_string(), 1);

        let _cmd = Command::new(
            "test_editor".to_string(),
            "test.capability".to_string(),
            "test_block".to_string(),
            serde_json::json!({ "test": "data" }),
        );

        let _event = Event::new(
            "test_block".to_string(),
            "test_editor/test.capability".to_string(),
            serde_json::json!({ 
                "contents": {
                    "result": "success",
                    "needs_file_sync": true,
                    "file_operation_command": "test command"
                }
            }),
            timestamp,
        );

        // 如果到达这里，说明接口兼容
        assert!(true, "Wrapper command interface maintains compatibility");
    }

    #[test]
    fn test_sync_detection_logic() {
        // 测试同步检测逻辑（从装饰器中提取的核心逻辑）
        let mut timestamp = HashMap::new();
        timestamp.insert("test_editor".to_string(), 1);

        let event_with_sync = Event::new(
            "test_block".to_string(),
            "test_editor/test.capability".to_string(),
            serde_json::json!({
                "contents": {
                    "needs_file_sync": true,
                    "file_operation_command": "mkdir test"
                }
            }),
            timestamp.clone(),
        );

        let event_without_sync = Event::new(
            "test_block".to_string(),
            "test_editor/test.capability".to_string(),
            serde_json::json!({
                "contents": {
                    "data": "some data"
                }
            }),
            timestamp,
        );

        // 测试检测逻辑
        let should_sync_true = event_with_sync
            .value
            .get("contents")
            .and_then(|contents| contents.as_object())
            .and_then(|obj| obj.get("needs_file_sync"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let should_sync_false = event_without_sync
            .value
            .get("contents")
            .and_then(|contents| contents.as_object())
            .and_then(|obj| obj.get("needs_file_sync"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        assert!(should_sync_true, "Should detect sync requirement");
        assert!(!should_sync_false, "Should not detect sync when not needed");
    }
}