/// 集成测试：Block 快照功能 (I1-01 ~ I1-04)
///
/// 验证 write 操作时物理文件同步写入：
/// - I1-01: markdown.write → block-{uuid}/body.md
/// - I1-02: code.write → block-{uuid}/body.{ext}
/// - I1-03: directory.import → 为每个 Content Block 写入物理文件 + Dir Block 写入 body.json
/// - I1-04: directory.write → entries 变化时同步更新 body.json
use elfiee_lib::elf::ElfArchive;
use elfiee_lib::engine::spawn_engine;
use elfiee_lib::models::Command;
use std::fs;
use tempfile::NamedTempFile;

/// 辅助函数：创建 engine 和 editor
async fn setup_engine() -> (
    ElfArchive,
    elfiee_lib::engine::EngineHandle,
    std::path::PathBuf,
) {
    let temp_elf = NamedTempFile::new().unwrap();
    let elf_path = temp_elf.path().to_path_buf();

    let archive = ElfArchive::new().await.unwrap();
    archive.save(&elf_path).unwrap();

    let archive = ElfArchive::open(&elf_path).unwrap();
    let event_pool = archive.event_pool().await.unwrap();
    let handle = spawn_engine("test".to_string(), event_pool).await.unwrap();

    // 创建 system editor
    let cmd = Command::new(
        "system".to_string(),
        "editor.create".to_string(),
        "system".to_string(),
        serde_json::json!({
            "editor_id": "system",
            "name": "System"
        }),
    );
    handle.process_command(cmd).await.unwrap();

    (archive, handle, elf_path)
}

/// 辅助函数：创建一个 block
async fn create_block(
    handle: &elfiee_lib::engine::EngineHandle,
    name: &str,
    block_type: &str,
) -> String {
    let cmd = Command::new(
        "system".to_string(),
        "core.create".to_string(),
        "".to_string(),
        serde_json::json!({
            "name": name,
            "block_type": block_type
        }),
    );
    let events = handle.process_command(cmd).await.unwrap();
    events[0].entity.clone()
}

// =============================================================================
// I1-01: markdown.write 快照
// =============================================================================

#[tokio::test]
async fn test_markdown_write_creates_snapshot() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    // 创建 markdown block
    let block_id = create_block(&handle, "README.md", "markdown").await;

    // 写入内容
    let cmd = Command::new(
        "system".to_string(),
        "markdown.write".to_string(),
        block_id.clone(),
        serde_json::json!({"content": "# Hello World\n\nThis is a test."}),
    );
    handle.process_command(cmd).await.unwrap();

    // 验证快照文件
    let snapshot_path = temp_path.join(format!("block-{}/body.md", block_id));
    assert!(snapshot_path.exists(), "body.md snapshot should exist");

    let content = fs::read_to_string(&snapshot_path).unwrap();
    assert_eq!(content, "# Hello World\n\nThis is a test.");

    handle.shutdown().await;
}

#[tokio::test]
async fn test_markdown_write_updates_snapshot() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    let block_id = create_block(&handle, "doc.md", "markdown").await;

    // 第一次写入
    let cmd1 = Command::new(
        "system".to_string(),
        "markdown.write".to_string(),
        block_id.clone(),
        serde_json::json!({"content": "Version 1"}),
    );
    handle.process_command(cmd1).await.unwrap();

    let snapshot_path = temp_path.join(format!("block-{}/body.md", block_id));
    assert_eq!(fs::read_to_string(&snapshot_path).unwrap(), "Version 1");

    // 第二次写入：快照应更新
    let cmd2 = Command::new(
        "system".to_string(),
        "markdown.write".to_string(),
        block_id.clone(),
        serde_json::json!({"content": "Version 2"}),
    );
    handle.process_command(cmd2).await.unwrap();

    assert_eq!(fs::read_to_string(&snapshot_path).unwrap(), "Version 2");

    handle.shutdown().await;
}

// =============================================================================
// I1-02: code.write 快照
// =============================================================================

#[tokio::test]
async fn test_code_write_creates_snapshot_with_extension() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    // 创建 code block（名称带 .rs 扩展名）
    let block_id = create_block(&handle, "main.rs", "code").await;

    // 写入内容
    let cmd = Command::new(
        "system".to_string(),
        "code.write".to_string(),
        block_id.clone(),
        serde_json::json!({"content": "fn main() {\n    println!(\"hello\");\n}"}),
    );
    handle.process_command(cmd).await.unwrap();

    // 验证快照文件使用正确的扩展名
    let snapshot_path = temp_path.join(format!("block-{}/body.rs", block_id));
    assert!(
        snapshot_path.exists(),
        "body.rs snapshot should exist for .rs file"
    );

    let content = fs::read_to_string(&snapshot_path).unwrap();
    assert_eq!(content, "fn main() {\n    println!(\"hello\");\n}");

    handle.shutdown().await;
}

#[tokio::test]
async fn test_code_write_typescript_extension() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    let block_id = create_block(&handle, "index.ts", "code").await;

    let cmd = Command::new(
        "system".to_string(),
        "code.write".to_string(),
        block_id.clone(),
        serde_json::json!({"content": "const x: number = 42;"}),
    );
    handle.process_command(cmd).await.unwrap();

    let snapshot_path = temp_path.join(format!("block-{}/body.ts", block_id));
    assert!(snapshot_path.exists(), "body.ts snapshot should exist");
    assert_eq!(
        fs::read_to_string(&snapshot_path).unwrap(),
        "const x: number = 42;"
    );

    handle.shutdown().await;
}

#[tokio::test]
async fn test_code_write_no_extension_defaults_to_txt() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    let block_id = create_block(&handle, "Makefile", "code").await;

    let cmd = Command::new(
        "system".to_string(),
        "code.write".to_string(),
        block_id.clone(),
        serde_json::json!({"content": "all:\n\techo hello"}),
    );
    handle.process_command(cmd).await.unwrap();

    // 无扩展名时默认 body.txt
    let snapshot_path = temp_path.join(format!("block-{}/body.txt", block_id));
    assert!(
        snapshot_path.exists(),
        "body.txt snapshot should exist for extensionless file"
    );
    assert_eq!(
        fs::read_to_string(&snapshot_path).unwrap(),
        "all:\n\techo hello"
    );

    handle.shutdown().await;
}

// =============================================================================
// I1-03: directory.import 快照
// =============================================================================

#[tokio::test]
async fn test_directory_import_creates_content_snapshots() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    // 创建外部测试目录
    let ext_dir = tempfile::TempDir::new().unwrap();
    fs::write(ext_dir.path().join("README.md"), "# Project Docs").unwrap();
    fs::write(ext_dir.path().join("main.rs"), "fn main() {}").unwrap();
    fs::write(ext_dir.path().join("config.json"), r#"{"key":"val"}"#).unwrap();

    // 创建 directory block
    let dir_block_id = create_block(&handle, "src", "directory").await;

    // 导入
    let cmd = Command::new(
        "system".to_string(),
        "directory.import".to_string(),
        dir_block_id.clone(),
        serde_json::json!({
            "source_path": ext_dir.path().to_str().unwrap()
        }),
    );
    let events = handle.process_command(cmd).await.unwrap();

    // 找到所有创建的 content block
    let create_events: Vec<_> = events
        .iter()
        .filter(|e| e.attribute.ends_with("/core.create"))
        .collect();
    assert!(
        create_events.len() >= 3,
        "Should create at least 3 content blocks"
    );

    // 验证每个 content block 的快照
    for event in &create_events {
        let block_id = &event.entity;
        let block_name = event.value["name"].as_str().unwrap();
        let block_type = event.value["type"].as_str().unwrap();

        let block = handle.get_block(block_id.clone()).await;
        assert!(
            block.is_some(),
            "Block {} should exist in state",
            block_name
        );

        // 检查快照文件存在
        let block_dir = temp_path.join(format!("block-{}", block_id));
        assert!(
            block_dir.exists(),
            "Block dir for {} should exist",
            block_name
        );

        // 确定预期的快照文件名
        let expected_file = match block_type {
            "markdown" => "body.md".to_string(),
            "code" => {
                let ext = std::path::Path::new(block_name)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("txt");
                format!("body.{}", ext)
            }
            _ => "body.txt".to_string(),
        };

        let snapshot_path = block_dir.join(&expected_file);
        assert!(
            snapshot_path.exists(),
            "Snapshot {} should exist for block '{}'",
            expected_file,
            block_name
        );

        // 验证内容非空
        let content = fs::read_to_string(&snapshot_path).unwrap();
        assert!(
            !content.is_empty(),
            "Snapshot for {} should have content",
            block_name
        );
    }

    // 验证 Dir Block 的 body.json 快照（I1-03 + I1-04）
    let dir_snapshot = temp_path.join(format!("block-{}/body.json", dir_block_id));
    assert!(
        dir_snapshot.exists(),
        "Dir Block body.json snapshot should exist"
    );

    let dir_content = fs::read_to_string(&dir_snapshot).unwrap();
    // body.json 应包含 entries
    assert!(
        dir_content.contains("README.md"),
        "Dir snapshot should contain README.md entry"
    );
    assert!(
        dir_content.contains("main.rs"),
        "Dir snapshot should contain main.rs entry"
    );

    handle.shutdown().await;
}

// =============================================================================
// I1-04: Dir Block 快照同步（entries 变化时更新 body.json）
// =============================================================================

#[tokio::test]
async fn test_directory_write_updates_body_json() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    // 创建 directory block
    let dir_block_id = create_block(&handle, "project", "directory").await;

    // 直接用 directory.write 更新 entries
    let cmd = Command::new(
        "system".to_string(),
        "directory.write".to_string(),
        dir_block_id.clone(),
        serde_json::json!({
            "entries": {
                "src/main.rs": {"id": "block-1", "type": "file"},
                "README.md": {"id": "block-2", "type": "file"}
            },
            "source": "outline"
        }),
    );
    handle.process_command(cmd).await.unwrap();

    // 验证 body.json 快照
    let snapshot_path = temp_path.join(format!("block-{}/body.json", dir_block_id));
    assert!(
        snapshot_path.exists(),
        "body.json should exist after directory.write"
    );

    let content = fs::read_to_string(&snapshot_path).unwrap();
    assert!(
        content.contains("src/main.rs"),
        "Snapshot should contain src/main.rs"
    );
    assert!(
        content.contains("README.md"),
        "Snapshot should contain README.md"
    );

    // 再次更新 entries（添加新文件）
    let cmd2 = Command::new(
        "system".to_string(),
        "directory.write".to_string(),
        dir_block_id.clone(),
        serde_json::json!({
            "entries": {
                "src/main.rs": {"id": "block-1", "type": "file"},
                "README.md": {"id": "block-2", "type": "file"},
                "Cargo.toml": {"id": "block-3", "type": "file"}
            },
            "source": "outline"
        }),
    );
    handle.process_command(cmd2).await.unwrap();

    // 快照应更新
    let content2 = fs::read_to_string(&snapshot_path).unwrap();
    assert!(
        content2.contains("Cargo.toml"),
        "Updated snapshot should contain new entry"
    );

    handle.shutdown().await;
}

#[tokio::test]
async fn test_directory_create_updates_snapshot() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    // 创建 directory block
    let dir_block_id = create_block(&handle, "docs", "directory").await;

    // 通过 directory.create 添加文件（会生成 core.create + directory.write 事件）
    let cmd = Command::new(
        "system".to_string(),
        "directory.create".to_string(),
        dir_block_id.clone(),
        serde_json::json!({
            "path": "guide.md",
            "type": "file",
            "source": "outline",
            "content": "# Guide\n\nWelcome!",
            "block_type": "markdown"
        }),
    );
    handle.process_command(cmd).await.unwrap();

    // 验证 Dir Block 的 body.json 包含新 entry
    let dir_snapshot = temp_path.join(format!("block-{}/body.json", dir_block_id));
    assert!(dir_snapshot.exists(), "Dir body.json should exist");

    let content = fs::read_to_string(&dir_snapshot).unwrap();
    assert!(
        content.contains("guide.md"),
        "Dir snapshot should contain guide.md"
    );

    handle.shutdown().await;
}

// =============================================================================
// 快照持久化测试：保存 elf 后重新打开，快照文件依然存在
// =============================================================================

#[tokio::test]
async fn test_snapshot_persists_after_save_and_reopen() {
    let (archive, handle, elf_path) = setup_engine().await;

    // 创建 markdown block 并写入内容
    let block_id = create_block(&handle, "SKILL.md", "markdown").await;
    let cmd = Command::new(
        "system".to_string(),
        "markdown.write".to_string(),
        block_id.clone(),
        serde_json::json!({"content": "# My Skill\n\nThis is persisted."}),
    );
    handle.process_command(cmd).await.unwrap();

    // 保存并关闭
    archive.save(&elf_path).unwrap();
    handle.shutdown().await;

    // 重新打开
    let reopened = ElfArchive::open(&elf_path).unwrap();
    let reopened_temp = reopened.temp_path();

    // 验证快照文件在新的 temp 目录中依然存在
    let snapshot_path = reopened_temp.join(format!("block-{}/body.md", block_id));
    assert!(
        snapshot_path.exists(),
        "Snapshot should persist after save and reopen"
    );

    let content = fs::read_to_string(&snapshot_path).unwrap();
    assert_eq!(content, "# My Skill\n\nThis is persisted.");
}

// =============================================================================
// 边界情况测试
// =============================================================================

#[tokio::test]
async fn test_empty_content_write_no_snapshot() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    // 创建 markdown block（不写入内容）
    let block_id = create_block(&handle, "empty.md", "markdown").await;

    // block 创建后没有 markdown 内容，不应产生 body.md
    // （core.create 的 contents 中没有 "markdown" 字段）
    let block_dir = temp_path.join(format!("block-{}", block_id));
    let snapshot = block_dir.join("body.md");

    // 空 block 不应该有 body.md 快照
    assert!(
        !snapshot.exists(),
        "Empty markdown block should not have body.md snapshot"
    );

    handle.shutdown().await;
}

#[tokio::test]
async fn test_unicode_content_snapshot() {
    let (archive, handle, _elf_path) = setup_engine().await;
    let temp_path = archive.temp_path();

    let block_id = create_block(&handle, "中文文档.md", "markdown").await;

    let cmd = Command::new(
        "system".to_string(),
        "markdown.write".to_string(),
        block_id.clone(),
        serde_json::json!({"content": "# 你好世界\n\n这是中文内容 🎉"}),
    );
    handle.process_command(cmd).await.unwrap();

    let snapshot_path = temp_path.join(format!("block-{}/body.md", block_id));
    assert!(snapshot_path.exists());

    let content = fs::read_to_string(&snapshot_path).unwrap();
    assert_eq!(content, "# 你好世界\n\n这是中文内容 🎉");

    handle.shutdown().await;
}
