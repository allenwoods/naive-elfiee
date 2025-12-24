# CHANGELOG - Directory Extension (VFS Architecture)

## 日期: 2025-12-24
## 状态: 后端开发完成，进入前端对接阶段

---

## 1. 核心架构重构 (Backend VFS)

我们彻底重新设计并实现了 Directory Extension，将其定位为 Elfiee 内部的 **虚拟文件系统 (VFS) 管理器**。

- **扁平索引设计**: `Directory Block` 不再直接映射外部物理文件，而是存储一个扁平的 `Map<Path, BlockID>` 索引。这使得内部文件组织极为灵活且具备高性能。
- **Block 化存储**: 所有导入的文本文件（Markdown, Code）均被转化为独立的 Block 存入 Event Store，享受完整的版本回溯和协作能力。
- **内外隔离哲学**: 引入“版本化导入”策略。每次 Import 都会创建一个全新的快照，避免了复杂的实时同步冲突，通过 `checkout` (导出) 功能将内部修改物化到外部。

## 2. 新增核心能力 (Core Capabilities)

为了支撑目录管理，我们增强了 Elfiee 的基础内核：

- **`core.rename`**: 支持修改 Block 的 `name` 字段。
- **`core.change_type`**: 支持在不丢失 ID 的情况下修改 Block 类型（如 `.rs` 变 `.md`）。
- **`core.read` (逻辑概念)**: 统一了读取权限的验证逻辑。

## 3. Directory 扩展功能实现

实现了完整的目录管理 Capability 集：

- **`directory.import`**: 支持批量导入外部文件夹。具备：
    - **智能类型推断**: 自动识别 Markdown 和各种代码格式。
    - **安全过滤**: 自动忽略 `.git`, `node_modules`, `target` 等二进制和大文件目录。
    - **警告系统**: 在事件中记录因不支持而跳过的文件。
- **`directory.create`**: 支持在 VFS 内部创建虚拟文件夹或新内容 Block。
- **`directory.delete`**: **级联删除**。删除目录索引时，会自动物理销毁所有关联的内容 Block，杜绝孤儿数据。
- **`directory.rename`**: **联动更新**。重命名虚拟路径时，会自动触发 `core.rename` 保持 Block 显示名称的一致性。
- **`directory.write`**: 正式化了目录索引的修改行为，便于精细化权限控制。

## 4. 安全与权限加固 (CBAC & Security)

- **统一鉴权入口**: 在 `StateProjector` 中提取了权威的 `is_authorized` 函数，统一了所有读写操作的判定标准。
- **双重锁鉴权机制**: 针对敏感的导出操作，实现了：
    1. **项目级准入**: 验证是否拥有目录的导出权限。
    2. **内容级访问**: 遍历文件时，实时验证对每一个具体 Block 的读取权限（如 `markdown.read`）。
- **路径遍历防御**: 所有路径操作（Create, Rename, Checkout）均集成了对 `..` 组件的严格校验，严禁逃逸沙盒。
- **Checkout IO 分离**: 将底层文件系统操作重命名为 `checkout_workspace` (Tauri Command)，实现了“业务审计逻辑”与“底层 IO 能力”的彻底解耦。

## 5. 代码质量与测试闭环

- **自动化校验**: 扩展已通过 `elfiee-ext-gen validate` 的 18 项规范检查。
- **全量测试套件**: 
    - 31 项 Capability 单元测试（覆盖功能、权限、Payload）。
    - 1 项 Checkout 跨模块集成测试。
    - 专门的“路径隔离”测试（验证 `foo` 不会误伤 `foobar`）。
- **字段标准化**: 统一了 `text` 与 `markdown` 字段的读取优先级，消除了导出文件为空的隐患。

---

**后续计划**:
1. 封装前端 `DirectoryOperations`。
2. 重构 `FilePanel` 以支持 `__system_outline__` 自动补齐。
3. 实现侧边栏的多项目（Multi-root）动态渲染。
