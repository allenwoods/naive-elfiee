/// 集成测试：验证 get_block 命令的权限检查
///
/// 测试场景：
/// 1. block owner 可以读取自己的block
/// 2. 非owner但有read grant的editor可以读取block
/// 3. 非owner且没有read grant的editor不能读取block
/// 4. 不同block类型使用不同的read capability
use elfiee_lib::elf::ElfArchive;
use elfiee_lib::models::Command;
use elfiee_lib::state::AppState;
use std::sync::Arc;

#[tokio::test]
async fn test_get_block_owner_can_read() {
    // 测试场景1: block owner 可以读取自己的block
    let (state, _archive, file_id, block_id) = setup_test_env().await;

    // 使用 owner (system) 读取 block - 直接调用engine的check_grant
    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    // block owner总是被授权
    let has_permission = handle
        .check_grant(
            "system".to_string(),
            "markdown.read".to_string(),
            block_id.clone(),
        )
        .await;

    assert!(
        has_permission,
        "Block owner should always have read permission"
    );

    // 实际获取block
    let block = handle.get_block(block_id.clone()).await;
    assert!(block.is_some());
    assert_eq!(block.unwrap().block_id, block_id);
}

#[tokio::test]
async fn test_get_block_non_owner_with_grant_can_read() {
    // 测试场景2: 非owner但有read grant的editor可以读取block
    let (state, _archive, file_id, block_id) = setup_test_env().await;

    // 创建另一个 editor (alice)
    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    let create_alice_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "editor.create".to_string(),
        block_id: "alice".to_string(),
        payload: serde_json::json!({
            "editor_id": "alice",
            "name": "Alice"
        }),
        timestamp: chrono::Utc::now(),
    };
    handle.process_command(create_alice_cmd).await.unwrap();

    // alice 没有权限前不能读取
    let has_permission_before = handle
        .check_grant(
            "alice".to_string(),
            "markdown.read".to_string(),
            block_id.clone(),
        )
        .await;
    assert!(
        !has_permission_before,
        "Alice should not have permission initially"
    );

    // 授予 alice markdown.read 权限
    let grant_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.grant".to_string(),
        block_id: block_id.clone(),
        payload: serde_json::json!({
            "target_editor": "alice",
            "capability": "markdown.read",
            "target_block": block_id.clone()
        }),
        timestamp: chrono::Utc::now(),
    };
    handle.process_command(grant_cmd).await.unwrap();

    // alice 有权限后可以读取
    let has_permission_after = handle
        .check_grant(
            "alice".to_string(),
            "markdown.read".to_string(),
            block_id.clone(),
        )
        .await;

    assert!(
        has_permission_after,
        "Alice should have read permission after grant"
    );

    // 实际获取block
    let block = handle.get_block(block_id.clone()).await;
    assert!(block.is_some());
    assert_eq!(block.unwrap().block_id, block_id);
}

#[tokio::test]
async fn test_get_block_non_owner_without_grant_cannot_read() {
    // 测试场景3: 非owner且没有read grant的editor不能读取block
    let (state, _archive, file_id, block_id) = setup_test_env().await;

    // 创建另一个 editor (bob)，但不授予权限
    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    let create_bob_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "editor.create".to_string(),
        block_id: "bob".to_string(),
        payload: serde_json::json!({
            "editor_id": "bob",
            "name": "Bob"
        }),
        timestamp: chrono::Utc::now(),
    };
    handle.process_command(create_bob_cmd).await.unwrap();

    // bob 尝试读取 block（没有被授予权限）
    let has_permission = handle
        .check_grant(
            "bob".to_string(),
            "markdown.read".to_string(),
            block_id.clone(),
        )
        .await;

    assert!(
        !has_permission,
        "Bob should not have read permission without grant"
    );
}

#[tokio::test]
async fn test_get_block_different_block_types() {
    // 测试场景4: 不同block类型使用不同的read capability
    let (state, _archive, file_id, _markdown_block_id) = setup_test_env().await;

    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    // 创建 code block
    let create_code_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.create".to_string(),
        block_id: "temp".to_string(),
        payload: serde_json::json!({
            "block_type": "code",
            "name": "Test Code Block"
        }),
        timestamp: chrono::Utc::now(),
    };
    let events = handle.process_command(create_code_cmd).await.unwrap();
    let code_block_id = events[0].entity.clone();

    // 创建 alice editor
    let create_alice_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "editor.create".to_string(),
        block_id: "alice".to_string(),
        payload: serde_json::json!({
            "editor_id": "alice",
            "name": "Alice"
        }),
        timestamp: chrono::Utc::now(),
    };
    handle.process_command(create_alice_cmd).await.unwrap();

    // 授予 alice markdown.read 权限（注意是 markdown，不是 code）
    let grant_md_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.grant".to_string(),
        block_id: code_block_id.clone(),
        payload: serde_json::json!({
            "target_editor": "alice",
            "capability": "markdown.read",  // 错误的 capability
            "target_block": code_block_id.clone()
        }),
        timestamp: chrono::Utc::now(),
    };
    handle.process_command(grant_md_cmd).await.unwrap();

    // alice 尝试读取 code block（有 markdown.read 但需要 code.read）
    let has_wrong_permission = handle
        .check_grant(
            "alice".to_string(),
            "code.read".to_string(),
            code_block_id.clone(),
        )
        .await;

    assert!(
        !has_wrong_permission,
        "Should not have permission with wrong capability type"
    );

    // 现在授予正确的 code.read 权限
    let grant_code_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.grant".to_string(),
        block_id: code_block_id.clone(),
        payload: serde_json::json!({
            "target_editor": "alice",
            "capability": "code.read",  // 正确的 capability
            "target_block": code_block_id.clone()
        }),
        timestamp: chrono::Utc::now(),
    };
    handle.process_command(grant_code_cmd).await.unwrap();

    // alice 再次尝试读取 code block
    let has_correct_permission = handle
        .check_grant(
            "alice".to_string(),
            "code.read".to_string(),
            code_block_id.clone(),
        )
        .await;

    assert!(
        has_correct_permission,
        "Should have permission with correct capability type"
    );
}

#[tokio::test]
async fn test_get_block_directory_type() {
    // 测试 directory block 需要 directory.read 权限
    let (state, _archive, file_id, _markdown_block_id) = setup_test_env().await;

    let handle = state.engine_manager.get_engine(&file_id).unwrap();

    // 创建 directory block
    let create_dir_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.create".to_string(),
        block_id: "temp".to_string(),
        payload: serde_json::json!({
            "block_type": "directory",
            "name": "Test Directory"
        }),
        timestamp: chrono::Utc::now(),
    };
    let events = handle.process_command(create_dir_cmd).await.unwrap();
    let dir_block_id = events[0].entity.clone();

    // 创建 alice editor
    let create_alice_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "editor.create".to_string(),
        block_id: "alice".to_string(),
        payload: serde_json::json!({
            "editor_id": "alice",
            "name": "Alice"
        }),
        timestamp: chrono::Utc::now(),
    };
    handle.process_command(create_alice_cmd).await.unwrap();

    // alice 没有 directory.read 权限
    let has_permission_before = handle
        .check_grant(
            "alice".to_string(),
            "directory.read".to_string(),
            dir_block_id.clone(),
        )
        .await;

    assert!(
        !has_permission_before,
        "Should not have directory.read permission initially"
    );

    // 授予 directory.read 权限
    let grant_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.grant".to_string(),
        block_id: dir_block_id.clone(),
        payload: serde_json::json!({
            "target_editor": "alice",
            "capability": "directory.read",
            "target_block": dir_block_id.clone()
        }),
        timestamp: chrono::Utc::now(),
    };
    handle.process_command(grant_cmd).await.unwrap();

    // alice 有权限后应该成功
    let has_permission_after = handle
        .check_grant(
            "alice".to_string(),
            "directory.read".to_string(),
            dir_block_id.clone(),
        )
        .await;

    assert!(
        has_permission_after,
        "Should have directory.read permission after grant"
    );
}

// ========== Helper Functions ==========

/// 设置测试环境：创建 elf archive，启动 engine，创建 system editor 和一个 markdown block
async fn setup_test_env() -> (Arc<AppState>, ElfArchive, String, String) {
    // 直接创建新的archive，不保存到文件再打开（避免文件权限问题）
    let archive = ElfArchive::new().await.unwrap();
    let event_pool = archive.event_pool().await.unwrap();

    let file_id = "test-file".to_string();

    // 创建 AppState 并使用 engine_manager.spawn_engine
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
        timestamp: chrono::Utc::now(),
    };
    handle.process_command(create_editor_cmd).await.unwrap();

    // 创建一个 markdown block (owner 是 system)
    let create_block_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.create".to_string(),
        block_id: "temp".to_string(),
        payload: serde_json::json!({
            "block_type": "markdown",
            "name": "Test Markdown Block"
        }),
        timestamp: chrono::Utc::now(),
    };
    let events = handle.process_command(create_block_cmd).await.unwrap();
    let block_id = events[0].entity.clone();

    // 设置 active editor
    state.set_active_editor(file_id.clone(), "system".to_string());

    (state, archive, file_id, block_id)
}
