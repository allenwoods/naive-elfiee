# Directory Extension 开发指南

本扩展为 Elfiee 提供了虚拟文件系统 (VFS) 的管理能力，支持将外部项目导入为 Block，并管理内部文件的层级结构。

## 1. 核心能力 (Capabilities)

- **`directory.import`**: 扫描外部文件系统，将文本文件批量转化为 Block 并在索引中建立映射。采用“版本化导入”策略，总是生成新的索引记录。
- **`directory.export`**: 审计型能力。验证用户是否有权执行导出，并记录导出操作日志。
- **`directory.write`**: 系统能力。用于原子性地更新 Directory Block 的 `entries` 索引表。
- **`directory.create`**: 在虚拟路径中创建新的文件或目录 Block。
- **`directory.delete`**: 级联删除。从索引中移除路径，并同步销毁对应的内容 Block。
- **`directory.rename`**: 重命名/移动。更新索引路径，并同步调用 `core.rename` 更新 Block 的显示名称。

## 2. 数据结构 (Data Structures)

### Directory Block Content (`contents`)
```json
{
  "entries": {
    "src/main.rs": {
      "id": "block-uuid-1",
      "type": "file",
      "source": "linked",
      "external_path": "/path/to/src/main.rs",
      "updated_at": "2025-12-23T..."
    }
  }
}
```

### 字段规范
- **Markdown 文件**: 内容存储在 `contents.markdown`。
- **代码/其他文本**: 内容存储在 `contents.text`。
- **导出逻辑**: `checkout_workspace` 命令会优先尝试读取 `text` 字段，并以 `markdown` 字段作为兼容性兜底。

## 3. 安全性设计 (Security)

- **路径遍历防护**: 所有的 `path` 参数在处理前都会检查 `..` 组件，严禁逃逸出虚拟根目录。
- **双重鉴权**:
    - 第一层：检查对 Directory Block 的 `export` 权限。
    - 第二层：在导出过程中，对每一个子 Block 检查 `markdown.read` 或 `code.read` 权限。
- **敏感目录过滤**: `import` 过程中会自动忽略 `.git`, `node_modules`, `target` 等二进制或重型目录。

## 4. 开发注意事项

- **事件工厂模式**: Handler 不直接执行 I/O。`import` 只生成 `core.create` 事件，实际的内容写入由 Engine Actor 在 Replay 时完成（如果是 Asset），或直接由数据库持久化。
- **占位符计数**: 调用 `create_event` 时，`editor_count` 请填 `1`。Engine Actor 会在分发时自动将其替换为正确的 Vector Clock 值。