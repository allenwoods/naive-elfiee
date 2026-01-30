/// 集成测试：.elf/ Dir Block 初始化 (I10-01)
///
/// 验证：
/// - create_file 流程中 .elf/ Dir Block 自动创建
/// - entries 包含所有预期目录路径
/// - wildcard editor grant 授权正确
/// - 非 owner editor 可通过 wildcard grant 写入 .elf/
use elfiee_lib::engine::{spawn_engine, EventStore};
use elfiee_lib::models::Command;

/// 辅助函数：创建内存 engine + 注册 editor
async fn setup_engine() -> elfiee_lib::engine::EngineHandle {
    let event_pool = EventStore::create(":memory:").await.unwrap();
    spawn_engine("test_elf_meta".to_string(), event_pool, None)
        .await
        .unwrap()
}

/// 辅助函数：创建 editor
async fn create_editor(handle: &elfiee_lib::engine::EngineHandle, editor_id: &str) -> String {
    let cmd = Command::new(
        editor_id.to_string(),
        "editor.create".to_string(),
        "".to_string(),
        serde_json::json!({
            "editor_id": editor_id,
            "name": editor_id,
            "editor_type": "Human"
        }),
    );
    let events = handle.process_command(cmd).await.unwrap();
    events[0].entity.clone()
}

/// 辅助函数：创建 .elf/ Dir Block 并返回 block_id
///
/// 模拟 bootstrap_elf_meta 的流程（直接调用 process_command）
async fn bootstrap_elf_meta(handle: &elfiee_lib::engine::EngineHandle, editor_id: &str) -> String {
    // Step 1: core.create
    let create_cmd = Command::new(
        editor_id.to_string(),
        "core.create".to_string(),
        "".to_string(),
        serde_json::json!({
            "name": ".elf",
            "block_type": "directory",
            "source": "outline",
            "metadata": {
                "description": "Elfiee system metadata directory"
            }
        }),
    );
    let events = handle.process_command(create_cmd).await.unwrap();
    let elf_block_id = events[0].entity.clone();

    // Step 2: directory.write
    let entries = elfiee_lib::extensions::directory::elf_meta::build_elf_entries();
    let write_cmd = Command::new(
        editor_id.to_string(),
        "directory.write".to_string(),
        elf_block_id.clone(),
        entries,
    );
    handle.process_command(write_cmd).await.unwrap();

    // Step 3: core.grant wildcard
    let grant_cmd = Command::new(
        editor_id.to_string(),
        "core.grant".to_string(),
        elf_block_id.clone(),
        serde_json::json!({
            "target_editor": "*",
            "capability": "directory.write",
            "target_block": elf_block_id,
        }),
    );
    handle.process_command(grant_cmd).await.unwrap();

    elf_block_id
}

// ============================================================================
// 测试用例
// ============================================================================

#[tokio::test]
async fn test_elf_block_created() {
    let handle = setup_engine().await;
    create_editor(&handle, "system").await;
    let elf_id = bootstrap_elf_meta(&handle, "system").await;

    let block = handle.get_block(elf_id.clone()).await;
    assert!(block.is_some(), ".elf/ block should exist after bootstrap");

    let block = block.unwrap();
    assert_eq!(block.name, ".elf");
    assert_eq!(block.block_type, "directory");
    assert_eq!(block.owner, "system");
}

#[tokio::test]
async fn test_elf_block_entries_structure() {
    let handle = setup_engine().await;
    create_editor(&handle, "system").await;
    let elf_id = bootstrap_elf_meta(&handle, "system").await;

    let block = handle.get_block(elf_id).await.unwrap();
    let contents = block.contents.as_object().unwrap();
    let entries = contents.get("entries").unwrap().as_object().unwrap();

    // 验证所有预期目录路径
    let expected_paths = [
        "Agents/",
        "Agents/elfiee-client/",
        "Agents/elfiee-client/scripts/",
        "Agents/elfiee-client/assets/",
        "Agents/elfiee-client/references/",
        "Agents/session/",
        "git/",
    ];

    for path in &expected_paths {
        assert!(entries.contains_key(*path), "Missing entry: {}", path);
        let entry = entries.get(*path).unwrap().as_object().unwrap();
        assert_eq!(entry.get("type").unwrap().as_str().unwrap(), "directory");
        assert_eq!(entry.get("source").unwrap().as_str().unwrap(), "outline");
    }

    assert_eq!(entries.len(), expected_paths.len());
}

#[tokio::test]
async fn test_elf_block_source_outline() {
    let handle = setup_engine().await;
    create_editor(&handle, "system").await;
    let elf_id = bootstrap_elf_meta(&handle, "system").await;

    let block = handle.get_block(elf_id).await.unwrap();
    let contents = block.contents.as_object().unwrap();
    assert_eq!(
        contents.get("source").unwrap().as_str().unwrap(),
        "outline",
        ".elf/ block source should be outline (internal)"
    );
}

#[tokio::test]
async fn test_elf_block_wildcard_write_permission() {
    let handle = setup_engine().await;
    create_editor(&handle, "system").await;
    let elf_id = bootstrap_elf_meta(&handle, "system").await;

    // 非 owner editor "bob" 应该可以通过 wildcard grant 写入
    create_editor(&handle, "bob").await;

    let authorized = handle
        .check_grant(
            "bob".to_string(),
            "directory.write".to_string(),
            elf_id.clone(),
        )
        .await;

    assert!(
        authorized,
        "Non-owner editor should be authorized via wildcard grant"
    );
}

#[tokio::test]
async fn test_elf_block_wildcard_write_execution() {
    let handle = setup_engine().await;
    create_editor(&handle, "system").await;
    let elf_id = bootstrap_elf_meta(&handle, "system").await;

    // 创建非 owner editor
    create_editor(&handle, "bob").await;

    // bob 应该能执行 directory.write（通过 wildcard grant）
    let write_cmd = Command::new(
        "bob".to_string(),
        "directory.write".to_string(),
        elf_id.clone(),
        serde_json::json!({
            "entries": {
                "Agents/": {
                    "id": "dir-test",
                    "type": "directory",
                    "source": "outline",
                    "updated_at": "2025-01-30T00:00:00Z"
                },
                "Agents/elfiee-client/": {
                    "id": "dir-test2",
                    "type": "directory",
                    "source": "outline",
                    "updated_at": "2025-01-30T00:00:00Z"
                },
                "Agents/session/": {
                    "id": "dir-test3",
                    "type": "directory",
                    "source": "outline",
                    "updated_at": "2025-01-30T00:00:00Z"
                },
                "git/": {
                    "id": "dir-test4",
                    "type": "directory",
                    "source": "outline",
                    "updated_at": "2025-01-30T00:00:00Z"
                }
            },
            "source": "outline"
        }),
    );

    let result = handle.process_command(write_cmd).await;
    assert!(
        result.is_ok(),
        "Non-owner should be able to write to .elf/ via wildcard grant: {:?}",
        result.err()
    );
}

#[tokio::test]
async fn test_elf_block_no_write_without_grant() {
    let handle = setup_engine().await;
    create_editor(&handle, "system").await;

    // 创建 .elf/ block 但 不 grant wildcard
    let create_cmd = Command::new(
        "system".to_string(),
        "core.create".to_string(),
        "".to_string(),
        serde_json::json!({
            "name": ".elf",
            "block_type": "directory",
            "source": "outline"
        }),
    );
    let events = handle.process_command(create_cmd).await.unwrap();
    let elf_id = events[0].entity.clone();

    // 写入 entries（system 是 owner，可以写）
    let entries = elfiee_lib::extensions::directory::elf_meta::build_elf_entries();
    let write_cmd = Command::new(
        "system".to_string(),
        "directory.write".to_string(),
        elf_id.clone(),
        entries,
    );
    handle.process_command(write_cmd).await.unwrap();

    // bob 没有 grant，不能写
    create_editor(&handle, "bob").await;
    let write_cmd = Command::new(
        "bob".to_string(),
        "directory.write".to_string(),
        elf_id.clone(),
        serde_json::json!({
            "entries": {},
            "source": "outline"
        }),
    );

    let result = handle.process_command(write_cmd).await;
    assert!(
        result.is_err(),
        "Non-owner without grant should not be able to write"
    );
}

#[tokio::test]
async fn test_elf_block_metadata() {
    let handle = setup_engine().await;
    create_editor(&handle, "system").await;
    let elf_id = bootstrap_elf_meta(&handle, "system").await;

    let block = handle.get_block(elf_id).await.unwrap();

    // metadata 应包含 description
    let desc = block.metadata.description.as_deref().unwrap_or("");
    assert_eq!(desc, "Elfiee system metadata directory");
}
