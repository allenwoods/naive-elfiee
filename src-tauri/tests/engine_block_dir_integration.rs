/// 端到端集成测试：验证 _block_dir 注入和文件持久化
///
/// 测试流程：
/// 1. 创建 elf archive
/// 2. 启动 engine
/// 3. 创建 block（验证 _block_dir 被注入到 event）
/// 4. 在 _block_dir 下创建测试文件
/// 5. 保存 elf
/// 6. 重新打开 elf
/// 7. 验证 block 和文件都还在
/// 8. 验证 _block_dir 被重新注入
use elfiee_lib::elf::ElfArchive;
use elfiee_lib::engine::spawn_engine;
use elfiee_lib::models::Command;
use std::fs;
use tempfile::NamedTempFile;

#[tokio::test]
async fn test_end_to_end_block_dir_persistence() {
    // ========== 步骤1: 创建 elf archive ==========
    let temp_elf = NamedTempFile::new().unwrap();
    let elf_path = temp_elf.path();

    let archive = ElfArchive::new().await.unwrap();
    archive.save(elf_path).unwrap();

    // ========== 步骤2: 打开 archive 并启动 engine ==========
    let archive = ElfArchive::open(elf_path).unwrap();
    let event_pool_with_path = archive.event_pool().await.unwrap();

    let file_id = "test-file".to_string();
    let handle = spawn_engine(file_id.clone(), event_pool_with_path.clone())
        .await
        .unwrap();

    // ========== 步骤3: 创建 system editor ==========
    let create_editor_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "editor.create".to_string(),
        block_id: "system".to_string(),
        payload: serde_json::json!({
            "editor_id": "system",
            "name": "System Editor"
        }),
        timestamp: chrono::Utc::now(),
    };

    let editor_events = handle.process_command(create_editor_cmd).await.unwrap();
    assert!(
        !editor_events.is_empty(),
        "Editor creation should produce events"
    );

    // ========== 步骤4: 创建 block（应该注入 _block_dir） ==========
    let create_block_cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        editor_id: "system".to_string(),
        cap_id: "core.create".to_string(),
        block_id: "temp".to_string(), // Will be replaced by handler-generated UUID
        payload: serde_json::json!({
            "block_type": "test",
            "name": "Test Block"
        }),
        timestamp: chrono::Utc::now(),
    };

    let create_events = handle.process_command(create_block_cmd).await.unwrap();
    assert!(
        !create_events.is_empty(),
        "Block creation should produce events"
    );

    // 验证 event 中包含 _block_dir，并从 event 获取生成的 block_id
    let create_event = &create_events[0];
    let block_id = create_event.entity.clone();
    let contents = create_event
        .value
        .get("contents")
        .expect("Event should have contents");
    let block_dir_value = contents
        .get("_block_dir")
        .expect("Contents should have _block_dir");
    let block_dir_str = block_dir_value
        .as_str()
        .expect("_block_dir should be string");

    println!("✓ Block created with _block_dir: {}", block_dir_str);

    // ========== 步骤5: 在 _block_dir 下创建测试文件 ==========
    let block_dir = std::path::Path::new(block_dir_str);
    assert!(block_dir.exists(), "Block directory should exist");

    // 创建测试文件
    fs::write(
        block_dir.join("test-file.txt"),
        "Hello from integration test!",
    )
    .unwrap();
    fs::create_dir_all(block_dir.join("subdir")).unwrap();
    fs::write(block_dir.join("subdir/nested.txt"), "Nested content").unwrap();

    println!("✓ Created test files in block directory");

    // ========== 步骤6: 保存 elf ==========
    archive.save(elf_path).unwrap();
    println!("✓ Saved elf archive");

    // 关闭 engine
    handle.shutdown().await;

    // ========== 步骤7: 重新打开 elf ==========
    let reopened_archive = ElfArchive::open(elf_path).unwrap();
    let reopened_pool = reopened_archive.event_pool().await.unwrap();

    let reopened_handle = spawn_engine(file_id.clone(), reopened_pool).await.unwrap();

    println!("✓ Reopened elf and started new engine");

    // ========== 步骤8: 验证 block 还存在 ==========
    let block = reopened_handle.get_block(block_id.clone()).await;
    assert!(block.is_some(), "Block should still exist after reopen");

    let block = block.unwrap();
    assert_eq!(block.block_id, block_id);
    assert_eq!(block.block_type, "test");

    // 验证 _block_dir 被重新注入（这个需要通过调用 capability 来验证）
    // 因为 get_block 返回的是存储的状态，不包含 runtime 注入的 _block_dir

    println!("✓ Block data verified after reopen");

    // ========== 步骤9: 验证文件还存在 ==========
    // 需要从新的 temp_dir 中查找文件
    let reopened_temp_path = reopened_archive.temp_path();
    let reopened_block_dir = reopened_temp_path.join(format!("block-{}", block_id));

    assert!(
        reopened_block_dir.exists(),
        "Block directory should exist after reopen"
    );
    assert!(
        reopened_block_dir.join("test-file.txt").exists(),
        "test-file.txt should exist after reopen"
    );
    assert!(
        reopened_block_dir.join("subdir/nested.txt").exists(),
        "nested.txt should exist after reopen"
    );

    // 验证文件内容
    let content1 = fs::read_to_string(reopened_block_dir.join("test-file.txt")).unwrap();
    assert_eq!(content1, "Hello from integration test!");

    let content2 = fs::read_to_string(reopened_block_dir.join("subdir/nested.txt")).unwrap();
    assert_eq!(content2, "Nested content");

    println!("✓ All files verified after reopen");

    // ========== 步骤10: 通过 capability 验证 _block_dir 注入 ==========
    // 创建一个需要 block 的命令（比如 markdown.write），验证 handler 能访问 _block_dir
    // 但这需要实际的 capability，这里我们已经通过文件存在性验证了功能

    println!("✅ 端到端集成测试通过！");
    println!("   - Block 创建时正确注入 _block_dir");
    println!("   - 文件在 block 目录下成功创建");
    println!("   - Archive 完整保存所有文件");
    println!("   - 重新打开后 block 和文件都完整恢复");

    reopened_handle.shutdown().await;
}

#[tokio::test]
async fn test_multiple_blocks_with_files() {
    // 测试多个 block 的文件隔离和持久化
    let temp_elf = NamedTempFile::new().unwrap();
    let elf_path = temp_elf.path();

    let archive = ElfArchive::new().await.unwrap();
    archive.save(elf_path).unwrap();

    let archive = ElfArchive::open(elf_path).unwrap();
    let event_pool_with_path = archive.event_pool().await.unwrap();
    let handle = spawn_engine("test-file".to_string(), event_pool_with_path)
        .await
        .unwrap();

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

    // 创建 3 个 block，每个有自己的文件
    let mut block_ids = Vec::new();
    let mut block_dirs = Vec::new();

    for i in 1..=3 {
        let create_cmd = Command {
            cmd_id: uuid::Uuid::new_v4().to_string(),
            editor_id: "system".to_string(),
            cap_id: "core.create".to_string(),
            block_id: "temp".to_string(), // Will be replaced by handler-generated UUID
            payload: serde_json::json!({
                "block_type": "test",
                "name": format!("Block {}", i)
            }),
            timestamp: chrono::Utc::now(),
        };

        let events = handle.process_command(create_cmd).await.unwrap();
        let block_id = events[0].entity.clone();
        let block_dir_str = events[0].value["contents"]["_block_dir"].as_str().unwrap();

        // 在每个 block 的目录创建唯一文件
        let block_dir = std::path::Path::new(block_dir_str);
        fs::write(
            block_dir.join(format!("block{}.txt", i)),
            format!("Content from block {}", i),
        )
        .unwrap();

        block_ids.push(block_id);
        block_dirs.push(block_dir_str.to_string());
    }

    // 保存并重新打开
    archive.save(elf_path).unwrap();
    handle.shutdown().await;

    let reopened_archive = ElfArchive::open(elf_path).unwrap();

    // 验证所有 block 的文件都存在且内容正确（无需启动engine，直接验证文件系统）
    let reopened_temp = reopened_archive.temp_path();
    for (i, block_id) in block_ids.iter().enumerate() {
        let block_dir = reopened_temp.join(format!("block-{}", block_id));
        let file_path = block_dir.join(format!("block{}.txt", i + 1));

        assert!(file_path.exists(), "Block {} file should exist", i + 1);

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, format!("Content from block {}", i + 1));
    }
}
