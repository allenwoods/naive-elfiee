# Phase 2-3 功能与任务拆解 (Function & Task Breakdown)

**状态**: Draft
**基于**: `user-story.md`, `agent&terminal-design-v2.md`, `collaboration-design.md`

基于用户故事的拆解，以下是细粒度的开发任务列表，每个任务预估 0.5-1 天开发时间。

---

## 一、Core 模块（核心基础设施）

### 1.1 Node ID 系统 [0.5天] 👤后端
**对应**: Story 7 - 唯一节点标识
**负责人**: 后端开发

- [ ] 创建 `src-tauri/src/utils/node.rs` 模块
- [ ] 实现 `get_or_create_node_id()` 函数
- [ ] 在 `~/.elfiee/node_id` 持久化存储
- [ ] 添加单元测试（创建、读取、幂等性）
- [ ] 在应用启动时初始化 Node ID

### 1.2 Editor Identity 管理 [0.5天] 👤后端
**对应**: Story 3 - Agent 身份与配置
**负责人**: 后端开发

- [ ] 扩展 `Editor` 数据结构支持 Agent 类型
- [ ] 实现 `create_agent_editor(agent_id)` 函数
- [ ] 添加 `editor_type` 字段区分 User/Agent
- [ ] 编写 Editor 序列化/反序列化测试

---

## 二、Event 模块（事件系统）

### 2.1 Vector Clock Key 扩展 [1天] 👤后端
**对应**: Story 8 - 逻辑时钟防冲突
**负责人**: 后端开发

- [ ] 修改 `Event.timestamp` key 格式为 `node_id:editor_id`
- [ ] 实现 `create_timestamp(node_id, editor_id, count)` 辅助函数
- [ ] 更新 EventStore 的 `apply_event` 逻辑
- [ ] 实现 `extract_editor_id(key)` 解析函数
- [ ] 添加向后兼容测试（兼容旧格式）
- [ ] 迁移测试数据

### 2.2 Terminal Event 定义 [0.5天] 👤后端
**对应**: Story 1 - 外部模式终端
**负责人**: 后端开发

- [ ] 定义 `terminal.execute` Event 结构
- [ ] 定义 `terminal.output` Event 结构
- [ ] 实现 Event 的 apply 逻辑
- [ ] 添加 Event 序列化测试

### 2.3 Agent Proposal Event [1天] 👤后端
**对应**: Story 5 - 提案-批准机制
**负责人**: 后端开发

- [ ] 定义 `ai_agent.propose` Event 结构（包含 `proposed_commands` 字段）
- [ ] 定义 Proposal Commands 的 JSON Schema
- [ ] 实现 Proposal 状态机（Pending → Approved/Rejected）
- [ ] 添加 Proposal 存储和查询逻辑
- [ ] 编写 Proposal 生命周期测试

---

## 三、Relation 模块（关系系统）

### 3.1 RelationGraph 内存索引 [1天] 👤后端
**对应**: Story 6 - 自动建立因果关系
**负责人**: 后端开发

- [ ] 实现 `RelationGraph` 数据结构（outgoing/incoming）
- [ ] 在 `StateProjector` 中初始化 RelationGraph
- [ ] 实现 `rebuild_graph()` 从 Block.children 派生
- [ ] 实现环检测算法（DFS/BFS）
- [ ] 添加图遍历性能测试

### 3.2 Relation Tauri Commands [0.5天] 👤后端
**对应**: Story 6 - 自动建立因果关系
**负责人**: 后端开发

- [ ] 实现 `get_parents(block_id)` Tauri 命令
- [ ] 实现 `get_children(block_id)` Tauri 命令
- [ ] 实现 `add_relation(source, target, type)` 命令
- [ ] 添加权限检查（CBAC）
- [ ] 生成前端 TS 类型绑定

---

## 四、Terminal 模块

### 4.1 Terminal Config 重构 [1天] 👤后端
**对应**: Story 1 - 外部模式终端
**负责人**: 后端开发

- [ ] 定义 `TerminalConfig` 结构（shell, env, linked_directory_id）
- [ ] 实现 Block Type: `terminal` 注册
- [ ] 实现 `terminal.create` Capability
- [ ] 添加 Terminal Config 验证逻辑
- [ ] 编写配置解析单元测试

### 4.2 Terminal CWD 解析 [0.5天] 👤后端
**对应**: Story 1 - 外部模式终端
**负责人**: 后端开发

- [ ] 实现 `get_terminal_cwd(terminal_block, state)` 函数
- [ ] 实现关联 Directory 的路径读取逻辑
- [ ] 实现未关联时的 fallback 逻辑
- [ ] 添加路径解析测试

### 4.3 Terminal PTY 执行 [0.5天] 👤后端
**对应**: Story 1 - 外部模式终端
**负责人**: 后端开发

- [ ] 实现 `terminal.execute` Tauri 命令
- [ ] 集成 PTY 启动逻辑（使用解析的 CWD）
- [ ] 实现输出流捕获（stdout/stderr）
- [ ] 生成 `terminal.output` Event

### 4.4 导出检查前端 UI [1天] 🎨前端
**对应**: Story 2 - 运行前导出检查
**负责人**: 前端开发

- [ ] 创建 `ExportPromptDialog` 组件
- [ ] 实现三选项对话框（Export & Run / Run / Cancel）
- [ ] 实现"记住选择"复选框
- [ ] 集成 `sessionStorage` 存储用户偏好
- [ ] 添加对话框交互测试

### 4.5 导出检查前端逻辑 [0.5天] 🎨前端
**对应**: Story 2 - 运行前导出检查
**负责人**: 前端开发

- [ ] 在 `executeTerminalCommand()` 中添加检查逻辑
- [ ] 调用 `TauriClient.directory.export()`
- [ ] 处理用户偏好（always/never/ask）
- [ ] 添加导出失败的错误处理

---

## 五、Agent 模块

### 5.1 Agent Block 数据结构 [0.5天] 👤后端
**对应**: Story 3 - Agent 身份与配置
**负责人**: 后端开发

- [ ] 定义 `AgentConfig` 结构（editor_id, provider, model, system_prompt）
- [ ] 实现 Block Type: `ai_agent` 注册
- [ ] 实现 `ai_agent.create` Capability（自动生成 editor_id）
- [ ] 添加配置验证逻辑

### 5.2 LLM API 封装 [1天] 👤后端
**对应**: Story 5 - 提案-批准机制
**负责人**: 后端开发

- [ ] 创建 `src-tauri/src/llm/` 模块
- [ ] 实现 Anthropic API 客户端
- [ ] 实现 OpenAI API 客户端（可选）
- [ ] 统一 LLM Response 解析接口
- [ ] 处理 API 错误和重试逻辑
- [ ] 添加 Mock 测试

### 5.3 Agent Invoke Capability [1天] 👤后端
**对应**: Story 4, 5 - 上下文感知 & 提案机制
**负责人**: 后端开发

- [ ] 实现 `ai_agent.invoke` Capability
- [ ] 实现上下文收集逻辑（读取 children Blocks）
- [ ] 调用 LLM API 生成 Proposal
- [ ] 解析 LLM 返回的结构化命令
- [ ] 生成 `ai_agent.propose` Event
- [ ] 添加上下文构建测试

### 5.4 Agent 前端 UI - Chat 界面 [1天] 🎨前端
**对应**: Story 3, 4 - Agent 身份与配置 & 上下文感知
**负责人**: 前端开发

- [ ] 创建 `AgentChatPanel` 组件
- [ ] 实现消息列表（User/Agent）
- [ ] 实现输入框和发送按钮
- [ ] 显示 Agent 配置摘要（Model, Prompt）
- [ ] 添加 Loading 状态指示器

### 5.5 Agent 前端 UI - Proposal 审批 [1天] 🎨前端
**对应**: Story 5 - 提案-批准机制
**负责人**: 前端开发

- [ ] 创建 `ProposalCard` 组件
- [ ] 实现 Diff 预览（Monaco Editor）
- [ ] 实现 Approve/Reject 按钮
- [ ] 实现 Proposal 详情展开/折叠
- [ ] 添加批准后的执行进度显示

### 5.6 Proposal 执行逻辑 [0.5天] 🎨前端
**对应**: Story 5 - 提案-批准机制
**负责人**: 前端开发

- [ ] 解析 Proposal 的 `proposed_commands`
- [ ] 依次调用 Tauri Commands（block.create, code.write, core.link）
- [ ] 传递 Agent 的 `editor_id`
- [ ] 处理执行失败回滚
- [ ] 添加执行日志记录

---

## 六、Directory 模块

### 6.1 Directory Export 增强 [0.5天] 👤后端
**对应**: Story 2 - 运行前导出检查
**负责人**: 后端开发

- [ ] 优化 `directory.export` 性能（仅导出变更文件）
- [ ] 添加 `last_export_time` 元数据
- [ ] 实现 Dirty Blocks 检测逻辑
- [ ] 添加导出冲突检测（可选）

### 6.2 Directory 前端状态管理 [0.5天] 🎨前端
**对应**: Story 2 - 运行前导出检查
**负责人**: 前端开发

- [ ] 在 Zustand Store 中添加 `dirtyBlocks` 状态
- [ ] 实现 `markBlockDirty(block_id)` action
- [ ] 实现 `clearDirtyBlocks(dir_id)` action
- [ ] 集成导出后清除 dirty 状态

---

## 七、Frontend 通用功能

### 7.1 Relation 可视化组件 [1天] 🎨前端
**对应**: Story 6 - 自动建立因果关系
**负责人**: 前端开发

- [ ] 创建 `RelationGraphView` 组件（使用 React Flow）
- [ ] 实现节点渲染（Block 类型、标题）
- [ ] 实现边渲染（Relation 类型、箭头）
- [ ] 实现点击导航到 Block
- [ ] 添加布局算法（DAG 层级布局）

### 7.2 Agent Config 编辑器 [0.5天] 🎨前端
**对应**: Story 3 - Agent 身份与配置
**负责人**: 前端开发

- [ ] 创建 `AgentConfigForm` 组件
- [ ] 实现 Provider 下拉选择（Anthropic/OpenAI）
- [ ] 实现 Model 下拉选择
- [ ] 实现 System Prompt 文本框
- [ ] 实现 API Key 配置（环境变量名）

### 7.3 Terminal UI 集成 [0.5天] 🎨前端
**对应**: Story 1 - 外部模式终端
**负责人**: 前端开发

- [ ] 在 Terminal 组件中添加 Mode 指示器（Internal/External）
- [ ] 显示关联的 Directory 名称
- [ ] 实现 CWD 显示
- [ ] 添加配置切换 UI

---

## 八、集成测试与文档

### 8.1 E2E 测试：Terminal 外部模式 [0.5天] 🧪测试
**对应**: Story 1, 2
**负责人**: 全栈开发

- [ ] 测试创建 Directory + Terminal 关联
- [ ] 测试 Terminal CWD 正确解析
- [ ] 测试导出提示对话框流程
- [ ] 测试命令执行和输出捕获

### 8.2 E2E 测试：Agent Dogfooding [1天] 🧪测试
**对应**: Story 3, 4, 5, 6
**负责人**: 全栈开发

- [ ] 测试 Agent 创建和配置
- [ ] 测试 Agent 读取上下文
- [ ] 测试 Proposal 生成
- [ ] 测试 Proposal 审批和执行
- [ ] 测试关系自动建立

### 8.3 E2E 测试：Vector Clock 冲突 [0.5天] 🧪测试
**对应**: Story 7, 8
**负责人**: 后端开发

- [ ] 模拟多设备环境（不同 node_id）
- [ ] 测试同名 editor_id 不冲突
- [ ] 测试 Vector Clock 合并逻辑
- [ ] 测试 CBAC 权限检查不受影响

### 8.4 开发文档更新 [0.5天] 📝文档
**负责人**: 技术文档工程师

- [ ] 更新 Architecture 文档（Node ID, Relation Graph）
- [ ] 编写 Agent Extension 开发指南
- [ ] 编写 Terminal 使用手册
- [ ] 更新 API 文档（Tauri Commands）

---

## 任务汇总

| 模块 | 后端任务 | 前端任务 | 总计 |
|------|---------|---------|------|
| **Core** | 1 天 | - | 1 天 |
| **Event** | 2.5 天 | - | 2.5 天 |
| **Relation** | 1.5 天 | 1 天 | 2.5 天 |
| **Terminal** | 2 天 | 1.5 天 | 3.5 天 |
| **Agent** | 3.5 天 | 3.5 天 | 7 天 |
| **Directory** | 0.5 天 | 0.5 天 | 1 天 |
| **Frontend 通用** | - | 1 天 | 1 天 |
| **测试 & 文档** | 0.5 天 | 1.5 天 | 2 天 |
| **总计** | **11.5 天** | **9 天** | **20.5 天** |

---

## 推荐开发顺序

### Week 1: 基础设施与 Relation
1. Core: Node ID + Editor Identity (1 天)
2. Event: Vector Clock 扩展 (1 天)
3. Relation: Graph + Commands (1.5 天)
4. Frontend: Relation 可视化 (1 天)
5. 测试: Vector Clock 冲突 (0.5 天)

### Week 2: Terminal 完整功能
1. Terminal: Config + CWD + PTY (2 天)
2. Event: Terminal Events (0.5 天)
3. Directory: Export 增强 (0.5 天)
4. Frontend: 导出检查 UI + Terminal UI (2 天)
5. 测试: Terminal E2E (0.5 天)

### Week 3-4: Agent 核心与集成
1. Agent: Block + LLM API (1.5 天)
2. Event: Proposal Event (1 天)
3. Agent: Invoke Capability (1 天)
4. Frontend: Chat + Proposal UI (2 天)
5. Frontend: Proposal 执行 + Agent Config (1 天)
6. 测试: Agent Dogfooding E2E (1 天)
7. 文档: 开发文档更新 (0.5 天)
