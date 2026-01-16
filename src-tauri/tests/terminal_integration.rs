/// 集成测试：Terminal 功能完整生命周期和权限验证
///
/// 测试场景：
/// 1. Terminal 完整生命周期：创建 block → 保存内容 → 验证
/// 2. 权限验证：只有 block owner 可以保存 terminal 内容
use chrono::Utc;
use elfiee_lib::elf::ElfArchive;
use elfiee_lib::models::Command;
use elfiee_lib::state::AppState;
use std::sync::Arc;

/// Test 1: Terminal 完整生命周期
///
/// 验证：
/// 1. 创建 terminal block
/// 2. 保存 terminal 内容
/// 3. 验证 saved_content 和 saved_at 字段正确保存
#[tokio::test]
async fn test_terminal_full_lifecycle() {
    let (state, _archive, file_id, terminal_block_id) = setup_terminal_test_env().await;
    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    // 验证 terminal block 已创建
    let block = handle.get_block(terminal_block_id.clone()).await;
    assert!(block.is_some(), "Terminal block should exist");
    let block = block.unwrap();
    assert_eq!(block.block_type, "terminal");
    assert_eq!(block.owner, "system");

    // 保存 terminal 内容
    let terminal_output = "$ ls\nfile1.txt\nfile2.txt\n$ pwd\n/home/user\n";
    let timestamp = Utc::now().to_rfc3339();

    let save_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "terminal.save".to_string(),
        block_id: terminal_block_id.clone(),
        payload: serde_json::json!({
            "saved_content": terminal_output,
            "saved_at": timestamp.clone()
        }),
        timestamp: Utc::now(),
    };

    let result = handle.process_command(save_cmd).await;
    assert!(result.is_ok(), "Terminal save should succeed");

    let events = result.unwrap();
    assert_eq!(events.len(), 1, "Should generate exactly one event");

    // 验证保存的内容
    let updated_block = handle.get_block(terminal_block_id.clone()).await;
    assert!(updated_block.is_some(), "Updated block should exist");

    let updated_block = updated_block.unwrap();
    assert_eq!(
        updated_block.contents["saved_content"], terminal_output,
        "Saved content should match"
    );
    assert_eq!(
        updated_block.contents["saved_at"], timestamp,
        "Timestamp should match"
    );
}

/// Test 2: Terminal 权限验证
///
/// 验证：
/// 1. Block owner 可以保存内容
/// 2. 非 owner 且没有 grant 不能保存内容
/// 3. 非 owner 但有 grant 可以保存内容
#[tokio::test]
async fn test_terminal_save_authorization() {
    let (state, _archive, file_id, terminal_block_id) = setup_terminal_test_env().await;
    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    // 创建另一个 editor (alice)
    let create_alice_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "editor.create".to_string(),
        block_id: "alice".to_string(),
        payload: serde_json::json!({
            "editor_id": "alice",
            "name": "Alice"
        }),
        timestamp: Utc::now(),
    };
    handle.process_command(create_alice_cmd).await.unwrap();

    let terminal_output = "$ echo 'test'\ntest\n";
    let timestamp = Utc::now().to_rfc3339();

    // Alice (非 owner，没有 grant) 尝试保存 - 应该失败
    let save_cmd_alice_no_grant = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "alice".to_string(),
        cap_id: "terminal.save".to_string(),
        block_id: terminal_block_id.clone(),
        payload: serde_json::json!({
            "saved_content": terminal_output,
            "saved_at": timestamp.clone()
        }),
        timestamp: Utc::now(),
    };

    let result = handle.process_command(save_cmd_alice_no_grant).await;
    assert!(
        result.is_err(),
        "Alice should not be able to save without grant"
    );
    assert!(
        result.unwrap_err().contains("Authorization failed"),
        "Error should indicate authorization failure"
    );

    // 授予 alice terminal.save 权限
    let grant_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.grant".to_string(),
        block_id: terminal_block_id.clone(),
        payload: serde_json::json!({
            "target_editor": "alice",
            "capability": "terminal.save",
            "target_block": terminal_block_id.clone()
        }),
        timestamp: Utc::now(),
    };
    handle.process_command(grant_cmd).await.unwrap();

    // Alice (有 grant) 保存 - 应该成功
    let save_cmd_alice_with_grant = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "alice".to_string(),
        cap_id: "terminal.save".to_string(),
        block_id: terminal_block_id.clone(),
        payload: serde_json::json!({
            "saved_content": terminal_output,
            "saved_at": timestamp.clone()
        }),
        timestamp: Utc::now(),
    };

    let result = handle.process_command(save_cmd_alice_with_grant).await;
    assert!(result.is_ok(), "Alice should be able to save with grant");

    // 验证保存的内容
    let updated_block = handle.get_block(terminal_block_id.clone()).await;
    assert!(updated_block.is_some());
    let updated_block = updated_block.unwrap();
    assert_eq!(updated_block.contents["saved_content"], terminal_output);

    // System (owner) 可以保存 - 应该始终成功
    let new_content = "$ date\nMon Jan 13 10:30:00 UTC 2026\n";
    let new_timestamp = Utc::now().to_rfc3339();

    let save_cmd_system = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "terminal.save".to_string(),
        block_id: terminal_block_id.clone(),
        payload: serde_json::json!({
            "saved_content": new_content,
            "saved_at": new_timestamp.clone()
        }),
        timestamp: Utc::now(),
    };

    let result = handle.process_command(save_cmd_system).await;
    assert!(result.is_ok(), "Owner should always be able to save");

    // 验证更新的内容
    let final_block = handle.get_block(terminal_block_id.clone()).await;
    assert!(final_block.is_some());
    let final_block = final_block.unwrap();
    assert_eq!(final_block.contents["saved_content"], new_content);
    assert_eq!(final_block.contents["saved_at"], new_timestamp);
}

/// Test 3: 多次保存 - 内容覆盖
///
/// 验证：
/// - 多次保存会覆盖之前的内容
/// - 最后一次保存的内容被保留
#[tokio::test]
async fn test_terminal_multiple_saves() {
    let (state, _archive, file_id, terminal_block_id) = setup_terminal_test_env().await;
    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    // 第一次保存
    let content1 = "$ ls\nfile1.txt\n";
    let timestamp1 = Utc::now().to_rfc3339();
    let save_cmd1 = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "terminal.save".to_string(),
        block_id: terminal_block_id.clone(),
        payload: serde_json::json!({
            "saved_content": content1,
            "saved_at": timestamp1.clone()
        }),
        timestamp: Utc::now(),
    };
    handle.process_command(save_cmd1).await.unwrap();

    // 验证第一次保存
    let block1 = handle.get_block(terminal_block_id.clone()).await.unwrap();
    assert_eq!(block1.contents["saved_content"], content1);

    // 等待一小段时间以确保时间戳不同
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    // 第二次保存
    let content2 = "$ ls\nfile1.txt\nfile2.txt\n$ pwd\n/home/user\n";
    let timestamp2 = Utc::now().to_rfc3339();
    let save_cmd2 = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "terminal.save".to_string(),
        block_id: terminal_block_id.clone(),
        payload: serde_json::json!({
            "saved_content": content2,
            "saved_at": timestamp2.clone()
        }),
        timestamp: Utc::now(),
    };
    handle.process_command(save_cmd2).await.unwrap();

    // 验证第二次保存覆盖了第一次
    let block2 = handle.get_block(terminal_block_id.clone()).await.unwrap();
    assert_eq!(
        block2.contents["saved_content"], content2,
        "Content should be overwritten"
    );
    assert_ne!(timestamp2, timestamp1, "Timestamps should be different");
    assert_eq!(
        block2.contents["saved_at"], timestamp2,
        "Timestamp should be updated"
    );
}

/// Test 4: 空内容保存
///
/// 验证：
/// - 可以保存空字符串
/// - saved_at 时间戳仍然更新
#[tokio::test]
async fn test_terminal_save_empty_content() {
    let (state, _archive, file_id, terminal_block_id) = setup_terminal_test_env().await;
    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    let empty_content = "";
    let timestamp = Utc::now().to_rfc3339();

    let save_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "terminal.save".to_string(),
        block_id: terminal_block_id.clone(),
        payload: serde_json::json!({
            "saved_content": empty_content,
            "saved_at": timestamp.clone()
        }),
        timestamp: Utc::now(),
    };

    let result = handle.process_command(save_cmd).await;
    assert!(result.is_ok(), "Should be able to save empty content");

    let block = handle.get_block(terminal_block_id.clone()).await.unwrap();
    assert_eq!(block.contents["saved_content"], "");
    assert_eq!(block.contents["saved_at"], timestamp);
}

/// Helper function: 设置 terminal 测试环境
///
/// 返回：(AppState, ElfArchive, file_id, terminal_block_id)
async fn setup_terminal_test_env() -> (Arc<AppState>, ElfArchive, String, String) {
    // 创建新的 archive
    let archive = ElfArchive::new().await.unwrap();
    let event_pool = archive.event_pool().await.unwrap();

    let file_id = "test-file".to_string();

    // 创建 AppState 并启动 engine
    let state = Arc::new(AppState::default());
    state
        .engine_manager
        .spawn_engine(file_id.clone(), event_pool)
        .await
        .unwrap();

    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    // 创建 system editor
    let create_editor_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "editor.create".to_string(),
        block_id: "system".to_string(),
        payload: serde_json::json!({
            "editor_id": "system",
            "name": "System"
        }),
        timestamp: Utc::now(),
    };
    handle.process_command(create_editor_cmd).await.unwrap();

    // 创建一个 terminal block (owner 是 system)
    let create_terminal_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.create".to_string(),
        block_id: "temp".to_string(),
        payload: serde_json::json!({
            "block_type": "terminal",
            "name": "Test Terminal"
        }),
        timestamp: Utc::now(),
    };
    let events = handle.process_command(create_terminal_cmd).await.unwrap();
    let terminal_block_id = events[0].entity.clone();

    // 设置 active editor
    state.set_active_editor(file_id.clone(), "system".to_string());

    (state, archive, file_id, terminal_block_id)
}
