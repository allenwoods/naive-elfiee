# Changelog: Directory Extension (VFS & Linked Repos)

本日志记录了 Directory 扩展（虚拟文件系统）的设计、开发过程以及关键的技术决策。

## 1. 核心目标
Directory 扩展旨在提供一个虚拟文件系统 (VFS)，使用户能够在单一 Elf Archive 中组织多个 Block，并支持与物理文件系统的同步（导入/导出）。

## 2. 关键功能实现

### 后端能力 (Capabilities)
- **`directory.create`**: 支持创建虚拟目录和文件（Markdown/Code）。实现了 Block 的自动关联与初始化。
- **`directory.delete`**: 实现了级联删除逻辑，确保删除目录时，其下的所有子项（Block）也被清理。
- **`directory.rename`**: 支持移动和重命名。对于文件类型，会自动同步关联 Block 的 `name` 属性，保持 UI 一致性。
- **`directory.import`**: 核心同步功能。支持扫描外部磁盘路径，根据文件后缀推断 Block 类型，并批量导入到 VFS 中。
- **`directory.export`**: 实现了从 VFS 到物理磁盘的反向导出，支持整个项目或特定子目录的持久化。

### 前端交互
- **Linked Repo 视图**: 在 `FilePanel` 中引入了专门的 Linked Repo 树形展示。
- **删除项目**: 为 Linked Repo 根节点添加了“删除项目”功能，调用 `core.delete` 实现整树清理。
- **权限管理**: 在 `AgentContext` 中集成了目录权限的展示，虽然暂时回滚了后端的强制过滤，但在 UI 层保留了对 READ/WRITE/DELETE 概念的对齐。

## 3. 架构决策与设计模式

### 3.1 运行时路径注入 (`_block_dir`)
为了让 Command Handlers 能够安全地访问物理磁盘（用于 import/export 或存储大型二进制资源），我们采用了 **运行时注入** 模式：
- `EngineActor` 在分发命令前，根据当前 Archive 的临时路径动态计算 `_block_dir`。
- 该路径被注入到命令 Payload 中，Handler 无需关心物理路径的生成逻辑。

### 3.2 严格遵循 Capability 宏模式
在开发过程中，我们明确了系统的扩展模式：
- 必须使用 `#[capability]` 宏标注 Handler 函数。
- 宏会自动生成对应的 Unit Struct（如 `DirectoryCreateCapability`），并实现 `CapabilityHandler` trait。
- **决策**: 拒绝手动导出 Handler 函数或手动实现 Registry 注册逻辑，保持与 `core` 能力的架构对齐。

### 3.3 权限模型的权衡
在实施 `directory.read` 权限时，我们进行了深度讨论：
- **方案 A**: 在 Tauri Command 层进行过滤。
- **方案 B**: 在 Engine Actor/State Projector 层进行过滤。
- **结论**: 最终决定回退 Command 层的临时过滤实现。未来的最佳实践应当是在 Engine 层通过 `GetVisibleBlocks` 消息统一处理，以确保集成测试与运行时的行为完全一致，并保证系统在大规模 Block 场景下的性能。

## 4. 测试验证
- **集成测试**: 在 `engine_block_dir_integration.rs` 中通过端到端测试验证了 Block 创建、文件写入、Archive 保存、重新打开后的数据完整性。
- **回归测试**: 确保了 170+ 项后端单元测试和 100+ 项前端 Vitest 测试全部通过。

## 5. 后续计划
- **Engine 层过滤**: 正式在 `StateProjector` 中实现基于权限的可见性过滤。
- **二进制支持**: 扩展 Directory 逻辑以更好地处理非文本文件。
