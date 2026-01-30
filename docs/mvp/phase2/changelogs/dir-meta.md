# 2.4 .elf/ 元数据管理 — 开发变更记录

## 概述

在 `create_file` 时自动创建 `.elf/` Dir Block，提供系统级目录骨架。新增 `editor_id = "*"` 通配符支持"所有人"授权。

## 变更文件清单

### I10-01a: GrantsTable editor_id 通配符

**文件**: `src-tauri/src/capabilities/grants.rs`
- 重写 `has_grant()` 方法：先精确匹配 `editor_id`，再查 `"*"` 通配符条目
- 新增 `editor_id != "*"` 守卫，避免 `"*"` 查自身的无限递归
- 新增 4 个单元测试：
  - `test_wildcard_editor_grant`：`"*"` grant 匹配任意 editor
  - `test_wildcard_editor_revoke`：revoke `"*"` 后所有 editor 失去权限
  - `test_wildcard_editor_with_exact_grant`：精确 grant 和 wildcard grant 共存
  - `test_wildcard_editor_combined_with_wildcard_block`：双通配符（editor + block）

### I10-01b: .elf/ Dir Block 初始化逻辑

**文件**: `src-tauri/src/extensions/directory/elf_meta.rs`（新建）
- `ELF_DIR_PATHS` 常量：定义 7 个目录路径
- `build_elf_entries()` 纯函数：构造 entries JSON（全部 `type: "directory"`, `source: "outline"`）
- `bootstrap_elf_meta()` 异步函数：通过 3 个 `process_command` 创建 .elf/ Dir Block
  1. `core.create` — 创建 `.elf/` Dir Block
  2. `directory.write` — 写入目录骨架 entries
  3. `core.grant("*", "directory.write", elf_block_id)` — 所有人可写
- 新增 3 个单元测试：
  - `test_build_elf_entries_structure`：验证所有路径和字段
  - `test_build_elf_entries_count`：验证条目数量
  - `test_build_elf_entries_unique_ids`：验证 id 唯一性

**文件**: `src-tauri/src/extensions/directory/mod.rs`
- 新增 `pub mod elf_meta;` 模块导出

### I10-01c: 修改 create_file 调用链

**文件**: `src-tauri/src/commands/file.rs`
- 在 `create_file()` 中 `bootstrap_editors()` 之后新增 `bootstrap_elf_meta()` 调用
- 仅 `create_file` 触发，`open_file` 不触发

### 集成测试

**文件**: `src-tauri/tests/elf_meta_integration.rs`（新建）

7 个集成测试用例：

| 测试名 | 验证内容 |
|--------|---------|
| `test_elf_block_created` | .elf/ block 存在且 name/type/owner 正确 |
| `test_elf_block_entries_structure` | entries 包含全部 7 个目录路径 |
| `test_elf_block_source_outline` | source 为 "outline"（非 linked） |
| `test_elf_block_wildcard_write_permission` | 非 owner 通过 wildcard grant 获得授权 |
| `test_elf_block_wildcard_write_execution` | 非 owner 实际执行 directory.write 成功 |
| `test_elf_block_no_write_without_grant` | 无 wildcard grant 时非 owner 被拒绝 |
| `test_elf_block_metadata` | description 字段正确 |

## 目录骨架结构

```
.elf/
├── Agents/
│   ├── elfiee-client/
│   │   ├── scripts/
│   │   ├── assets/
│   │   └── references/
│   └── session/
└── git/
```

所有 entries 为虚拟目录（`type: "directory"`），不包含 content Block。

## 设计决策

| 决策 | 结论 | 理由 |
|------|------|------|
| 权限方案 | editor_id `"*"` 通配符 | 对称设计，改动最小 |
| entries 内容 | 仅虚拟目录 | .elf/ 是骨架模板，内容由后续模块填充 |
| 触发时机 | 仅 create_file | open_file 已有 events 无需重复 |
| git/ 目录 | 预留 pre-commit/pre-push hook 模板 | 防止绕过 Elfiee 直接提交 |
| 实现方式 | 通过 process_command | 保证 capability 检查、vector clock、快照一致性 |
| source 值 | "outline" | 系统内部创建，非外部导入 |

## 测试结果

全部 **308 个后端测试通过**（267 单元 + 34 集成 + 5 文档 + 2 ignored）。
全部 **89 个前端测试通过**。

## 与 task-and-cost_v3.md 的对照

| v3 编号 | v3 任务 | 对应实现 | 状态 |
|---------|---------|---------|------|
| I10-01 | .elf/ Dir Block 初始化 | I10-01a (grant 通配符) + I10-01b (初始化逻辑) + I10-01c (调用链) | 完成 |
