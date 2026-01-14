# Phase 2 任务规划与预算

**文档状态**: Draft
**创建日期**: 2026-01-13
**最后更新**: 2026-01-13
**基于文档**: `target-and-story.md`

---

## 一、总体预算概览

### 1.1 预算分配

| 角色类型 | 总预算（人时） | 占比 | 说明 |
| :--- | :--- | :--- | :--- |
| **研发团队** | 183 人时 | 68% | 后端 + 前端 + 测试 |
| **产品团队** | 85 人时 | 32% | 需求 + 设计 + 研究 + Dogfooding |
| **总计** | 268 人时 | 100% | 约 3 周（每周 90 人时） |

### 1.2 时间安排

- **总工期**: 3 周
- **团队配置**: 5 人（2 后端 + 1.5 前端 + 0.5 测试 + 1 产品）
- **每周投入**: 85-90 人时
- **风险预留**: 见第五章（包含 Terminal 文件同步的额外风险）

### 1.3 功能范围

**研发功能（8 个）**：
- Terminal 模块：F1 (P0), F2 (P1)
- Agent 模块：F3 (P0), F4 (P0), F5 (P0), F6 (P0)
- Relation 模块：F7 (P0), F8 (P1)

**产品研究（5 个）**：
- R1, R2, R3 (P0)
- R4, R5 (P1)

---

## 二、研发任务规划（183 人时）

**说明**:
- 任务按 **Extension Capability** 组织，每个任务明确需要修改的文件
- Agent 无独立聊天界面，在 Markdown Block 中统一交互
- F2 (Terminal-Block 交互能力) 涉及文件监听和自动同步，技术复杂度高
- **新增**: M6/M8 里程碑相关任务（Event 逻辑整理 + 上下文优化），增加 11 人时

### 2.1 后端开发（107 人时）

#### 2.1.1 Terminal Extension（28 人时）

**文件结构**: `src-tauri/src/extensions/terminal/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-TERM-01** | 扩展 TerminalInitPayload | `pty.rs` | 在 `TerminalInitPayload` 中添加 `linked_directory_id: Option<String>` 字段，支持关联 Directory Block | 2 | F1 |
| **B-TERM-02** | 实现工作目录解析 | `pty.rs` | 在 `async_init_terminal` 中实现：如果 `linked_directory_id` 存在，从 Directory Block 的 `metadata.custom["external_root_path"]` 读取 cwd | 3 | F1 |
| **B-TERM-03** | 实现 cd 命令拦截 | `pty.rs` | 在 PTY 输出流中拦截 `cd ~` 命令，解析为 Block 解压目录路径 | 3 | F1 |
| **B-TERM-04** | 创建 workspace_mount.rs | `workspace_mount.rs` (新建) | 定义 `WorkspaceMountPayload`，实现 `terminal.workspace_mount` capability：在 `/tmp/elfiee-workspace-{block_id}` 创建物理文件副本，将 Directory Block 内容导出 | 6 | F2 |
| **B-TERM-05** | 创建 workspace_sync.rs | `workspace_sync.rs` (新建) | 定义 `WorkspaceSyncPayload`，实现 `terminal.workspace_sync` capability：使用 `notify` crate 监听文件变化，触发 `directory.import` 更新 Block | 8 | F2 |
| **B-TERM-06** | 创建 agent_config.rs | `agent_config.rs` (新建) | 定义 `AgentConfigPayload`，实现 `terminal.config_agent` capability：配置 Agent 调用方式（API 或 Terminal 命令） | 3 | F2 |
| **B-TERM-07** | 注册 Terminal Capabilities | `mod.rs` + `lib.rs` | 导出新 Payload 类型，在 `lib.rs` 中注册 `.typ::<WorkspaceMountPayload>()` 等 | 3 | F1-F2 |

#### 2.1.2 Agent Extension（52 人时）

**文件结构**: `src-tauri/src/extensions/agent/` (新建模块)

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-AGENT-01** | 创建 Agent 模块骨架 | `mod.rs` (新建) | 定义 `AgentConfig` 结构体：`editor_id`, `provider`, `model`, `api_key_env`, `system_prompt` | 2 | F3 |
| **B-AGENT-02** | 实现 agent.create | `agent_create.rs` (新建) | 定义 `AgentCreatePayload`，实现 `agent.create` capability：创建 Agent Block，自动生成 `editor_id = "agent-{uuid}"`，同时调用 `editor.create` 创建 Editor | 4 | F3 |
| **B-AGENT-03** | 实现 agent.configure | `agent_configure.rs` (新建) | 定义 `AgentConfigurePayload`，实现 `agent.configure` capability：验证 API Key 环境变量，更新 `AgentConfig` | 4 | F3 |
| **B-AGENT-04** | 创建 LLM Client | `llm/anthropic.rs` (新建) | 封装 Anthropic API 调用：使用 `reqwest` 发送 POST 请求到 `https://api.anthropic.com/v1/messages`，处理流式响应 | 8 | F4 |
| **B-AGENT-05** | 实现结构化输出解析 | `llm/parser.rs` (新建) | 解析 LLM 返回的结构化 XML/JSON，提取 `<command>` 标签，转换为 `ProposedCommand` 结构体 | 4 | F4 |
| **B-AGENT-06** | 实现 API 错误处理 | `llm/error.rs` (新建) | 定义 `LlmError` 枚举：Network, RateLimit, InvalidResponse, Unauthorized，实现重试逻辑 | 4 | F4 |
| **B-AGENT-07** | 定义 Proposal Event | `models/event.rs` (修改) | 在 Event 的 `value` 字段中定义 `proposal` 子结构：`proposed_commands: Vec<ProposedCommand>`, `status: "pending" | "approved" | "rejected"` | 4 | F5 |
| **B-AGENT-08** | 实现 agent.invoke | `agent_invoke.rs` (新建) | 定义 `AgentInvokePayload`，实现 `agent.invoke` capability：调用 LLM API，解析输出，生成 Proposal Event（Entity = agent block_id，不修改状态） | 5 | F5 |
| **B-AGENT-09** | 实现 agent.approve | `agent_approve.rs` (新建) | 定义 `AgentApprovePayload`，实现 `agent.approve` capability：解析 Proposal Event 中的 `proposed_commands`，依次调用 `execute_command`（使用 Agent 的 editor_id） | 5 | F5 |
| **B-AGENT-10** | 实现上下文收集器 | `context/collector.rs` (新建) | 实现 `collect_context(block_id, depth)`：遍历 `Block.children` 中的 `reference` 关系，读取关联 Block 的 `contents`，拼接为 Markdown 上下文 | 6 | F6 |
| **B-AGENT-11** | 实现基础 Token 截断 | `context/truncator.rs` (新建) | 实现 `truncate_context(context, max_tokens)`：使用 `tiktoken-rs` 计算 Token 数，从最旧的 Block 开始截断，保证总 Token < max_tokens | 3 | F6 |
| **B-AGENT-12** | 实现基于 Event 逻辑的上下文优化 | `context/event_optimizer.rs` (新建) | 实现 `optimize_context_by_events(block_id, max_tokens)`：调用 `get_events_by_relation` 获取因果链 Event，优先保留因果链上的 Block，删除无关 Block | 6 | M8 里程碑 |
| **B-AGENT-13** | 注册 Agent Capabilities | `mod.rs` + `lib.rs` | 在 `extensions/mod.rs` 中添加 `pub mod agent;`，在 `lib.rs` 中注册所有 Agent Payload 类型，添加 `commands::agent::invoke_agent` 等 Tauri 命令（如果需要） | 2 | F3-F6 |

#### 2.1.3 Relation 模块（27 人时）

**文件结构**: `src-tauri/src/engine/` (引擎级别，非 Extension)

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-REL-01** | 定义 RelationGraph 结构 | `state.rs` (修改) | 在 `StateProjector` 中添加 `relation_graph: RelationGraph` 字段，定义 `RelationGraph { outgoing: HashMap<String, Vec<(String, String)>>, incoming: HashMap<String, Vec<(String, String)>> }` | 4 | F7 |
| **B-REL-02** | 实现双向索引构建 | `state.rs` (修改) | 在 `StateProjector::apply_event` 中，每次 `core.link` 时同步更新 `outgoing` 和 `incoming` 索引 | 4 | F7 |
| **B-REL-03** | 实现环检测算法 | `state.rs` (修改) | 实现 `check_cycle(source: &str, target: &str) -> bool`：使用 DFS 在 `Block.children` 上检测环，在 `core.link` 的 certificator 中调用 | 5 | F7 |
| **B-REL-04** | 实现 Relation 查询 API | `commands/relation.rs` (新建) | 实现 Tauri 命令：`get_parents(block_id)` 查询 `incoming`，`get_children(block_id)` 查询 `outgoing`，`get_relation_path(source, target)` 查询路径 | 5 | F7 |
| **B-REL-05** | 实现 Event 逻辑整理 API | `commands/relation.rs` (扩展) | 实现 `get_events_by_relation(block_id, relation_type)`：根据 Relation 关系筛选相关 Event，返回因果链 Event 列表，支持按 `reference`/`implement` 关系过滤 | 6 | M6 里程碑 |
| **B-REL-06** | 注册 Relation Commands | `lib.rs` (修改) | 在 `tauri_specta::collect_commands![]` 中添加 `commands::relation::get_parents`、`get_events_by_relation` 等 | 2 | F7 |

**后端开发小计**: 107 人时

---

### 2.2 前端开发（52 人时）

#### 2.2.1 Terminal 模块（10 人时）

**文件结构**: `src/components/Terminal/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-TERM-01** | 增强 Terminal 组件 | `TerminalBlock.tsx` | 在 Terminal Block 配置中添加 `linkedDirectoryId` 字段，调用 `async_init_terminal` 时传入 | 3 | F1 |
| **F-TERM-02** | 实现 Workspace 状态展示 | `WorkspaceStatus.tsx` (新建) | 创建 Workspace 状态指示器：显示物理文件路径、同步状态（syncing/idle）、冲突提示 | 3 | F2 |
| **F-TERM-03** | 实现 Agent 调用方式配置 | `AgentConfigPanel.tsx` (新建) | 在 Terminal 配置面板中添加 "Agent 调用方式" 选项：API / Terminal 命令，调用 `terminal.config_agent` | 2 | F2 |
| **F-TERM-04** | 实现手动同步按钮 | `TerminalBlock.tsx` | 添加 "Sync to Block" 按钮，调用 `terminal.workspace_sync` 手动触发同步（降级策略） | 2 | F2 |

#### 2.2.2 Agent 模块（28 人时）

**文件结构**: `src/components/Agent/`

**关键说明**: Agent 无独立聊天界面，在 Markdown Block 中交互

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-AGENT-01** | 创建 Agent Block 配置表单 | `AgentConfigForm.tsx` (新建) | 创建 Agent Block 时的配置表单：Provider（下拉）、Model（下拉）、API Key Env（输入框）、System Prompt（文本框），调用 `agent.create` | 4 | F3 |
| **F-AGENT-02** | 在 Markdown 中集成 Agent 调用 | `MarkdownBlock.tsx` (修改) | 在 Markdown 编辑器中添加 "@agent" mention 功能：输入 `@agent-name` 触发 Agent，将 Markdown 内容作为 Prompt 发送到 `agent.invoke` | 6 | F3 |
| **F-AGENT-03** | 实现 LLM 调用状态管理 | `useAgentInvoke.ts` (新建) | 自定义 Hook：管理 LLM 调用状态（idle/loading/success/error），处理流式响应，更新 UI | 3 | F4 |
| **F-AGENT-04** | 创建 Proposal Card 组件 | `ProposalCard.tsx` (新建) | 渲染 Proposal Event：显示 `proposed_commands` 列表，每个 Command 显示为卡片（cap_id + payload 预览），提供 Approve/Reject 按钮 | 8 | F5 |
| **F-AGENT-05** | 实现 Diff 预览 | `DiffPreview.tsx` (新建) | 对于 `code.write` 类型的 Command，使用 `react-diff-viewer` 显示代码变更前后对比 | 4 | F5 |
| **F-AGENT-06** | 实现 Approval 执行逻辑 | `useProposalApproval.ts` (新建) | 自定义 Hook：调用 `agent.approve`，依次执行 `proposed_commands` 中的 Command，显示执行进度，处理失败回滚 | 3 | F5 |

#### 2.2.3 Relation 模块（18 人时）

**文件结构**: `src/components/RelationGraph/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-REL-01** | 创建 RelationGraph 组件 | `RelationGraph.tsx` (新建) | 使用 `@xyflow/react` (React Flow) 渲染关系图：调用 `get_parents` 和 `get_children` 构建节点和边，支持拖拽和缩放 | 8 | F8 |
| **F-REL-02** | 实现 DAG 布局算法 | `useGraphLayout.ts` (新建) | 使用 `dagre` 库计算分层布局：根据 `reference` 和 `implement` 关系计算节点位置 | 4 | F8 |
| **F-REL-03** | 实现节点交互逻辑 | `RelationGraph.tsx` | 节点点击事件：跳转到对应 Block，节点 Hover：显示 Block 元信息（title, type, owner） | 2 | F8 |
| **F-REL-04** | 实现 Event 逻辑链展示 | `EventLogicChain.tsx` (新建) | 调用 `get_events_by_relation` 获取因果链 Event，在 RelationGraph 中高亮显示因果链路径，支持按 Relation 类型筛选 | 4 | M6 里程碑 |

**前端开发小计**: 56 人时

---

### 2.3 测试与集成（20 人时）

**文件结构**: `src-tauri/src/extensions/{extension}/tests.rs` + `src/__tests__/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 覆盖范围 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T-UNIT-01** | Terminal Extension 单元测试 | `terminal/tests.rs` | 测试 `terminal.workspace_mount` 导出正确性，`terminal.workspace_sync` 同步逻辑，`cd ~` 拦截功能 | 3 | F1-F2 |
| **T-UNIT-02** | Agent Extension 单元测试 | `agent/tests.rs` | 测试 `agent.create` 自动创建 Editor，`agent.invoke` 生成 Proposal Event，上下文收集器读取关系 | 3 | F3-F6 |
| **T-UNIT-03** | Relation 模块单元测试 | `engine/tests/relation_tests.rs` | 测试环检测算法（环形 DAG 拒绝），双向索引一致性，`get_parents` / `get_children` 查询正确性 | 2 | F7 |
| **T-INT-01** | Agent Proposal 集成测试 | `tests/integration/agent_proposal.rs` | 端到端测试：`agent.invoke` → Proposal Event 生成 → `agent.approve` → 执行 Commands → Block 状态更新 | 4 | F3-F6 |
| **T-INT-02** | Terminal Workspace 集成测试 | `tests/integration/terminal_workspace.rs` | 端到端测试：`terminal.workspace_mount` → 物理文件生成 → Terminal 执行命令 → `terminal.workspace_sync` → Block 更新 | 4 | F1-F2 |
| **T-E2E-01** | Dogfooding 场景 E2E 测试 | `src/__tests__/e2e/dogfooding.spec.ts` | 完整流程测试：创建 Agent Block → 在 Markdown 中 @agent 调用 → Proposal Card 显示 → Approve → 代码生成 → Terminal 运行测试 | 4 | F1-F8 |

**测试小计**: 20 人时

---

**研发总计**: 183 人时（后端 107 + 前端 56 + 测试 20）

**增量说明**: 相比初始预算增加 11 人时，主要用于：
- **B-REL-05**: Event 逻辑整理 API（6 人时）- 支持 M6 里程碑
- **B-AGENT-12**: 基于 Event 逻辑的上下文优化（6 人时）- 支持 M8 里程碑
- **F-REL-04**: Event 逻辑链展示（4 人时）- 前端可视化
- **优化调整**: B-AGENT-11 从 4 人时优化为 3 人时（-1 人时）

---

## 三、产品任务规划（85 人时）

### 3.1 需求与交互设计（35 人时）

| 编号 | 任务名称 | 预估人时 | 对应研究主题 |
| :--- | :--- | :--- | :--- |
| **P-REQ-01** | Terminal 交互规范 | 5 | - |
| **P-REQ-02** | Agent 交互规范 | 8 | R2: Proposal 交互设计 |
| **P-REQ-03** | Relation 可视化规范 | 5 | R4: Traceability 形式探索 |
| **P-UX-01** | Proposal UI 原型 | 8 | R2: Proposal 交互设计 |
| **P-UX-02** | Markdown @agent 交互设计 | 5 | - |
| **P-UX-03** | Relation Graph 设计 | 4 | R4: Traceability 形式探索 |

### 3.2 用户研究（25 人时）

| 编号 | 任务名称 | 预估人时 | 对应研究主题 |
| :--- | :--- | :--- | :--- |
| **P-COMP-01** | AI 协作竞品分析 | 10 | R1: AI 协作竞品分析 |
| **P-DOG-01** | Dogfooding 场景 1 | 8 | R3: Dogfooding 效果追踪 |
| **P-DOG-02** | Dogfooding 场景 2 | 7 | R3: Dogfooding 效果追踪 |

### 3.3 知识沉淀（25 人时）

| 编号 | 任务名称 | 预估人时 | 对应研究主题 |
| :--- | :--- | :--- | :--- |
| **P-DOC-01** | 交互规范文档输出 | 6 | - |
| **P-DOC-02** | Dogfooding 效果报告 | 8 | R3: Dogfooding 效果追踪 |
| **P-DOC-03** | 竞品分析报告 | 5 | R1: AI 协作竞品分析 |
| **P-DOC-04** | Agent Prompt 模板 | 6 | R5: Agent System Prompt 模板 |

**产品总计**: 85 人时（需求设计 35 + 用户研究 25 + 知识沉淀 25）

---

## 四、里程碑与依赖

### 4.1 开发节奏与里程碑

**总体节奏**: 用户研究 → 基础功能 → 交互验证 → 完整功能 → Dogfooding 追踪 → 高级功能 → Dogfooding 执行 → 优化

**里程碑划分**:

| 里程碑 | 时间节点 | 开发内容 | 验收标准 | 对应任务 |
| :--- | :--- | :--- | :--- | :--- |
| **M1: 基础功能就绪** | Week 1 前 3 天 | 1. Terminal 基本功能（cwd 到目录跑命令）<br>2. Agent 基本配置和调用回显<br>3. Relation 数据结构 | ✓ Terminal 支持 `linked_directory_id`，可以 cd 到目录执行命令<br>✓ Agent Block 可创建，配置 API Key<br>✓ `agent.invoke` 返回 LLM 回显<br>✓ RelationGraph 结构完成，支持双向索引 | B-TERM-01～03<br>B-AGENT-01～04<br>B-REL-01～02 |
| **M2: Agent-Terminal 交互验证** | Week 1 第 4-5 天 | 产品 + 研发联合验证 Agent 和 Terminal 基础交互 | ✓ 在 Markdown 中 @agent 调用成功<br>✓ Terminal 可执行简单命令并显示输出<br>✓ 验证交互流程合理性 | F-AGENT-01～02<br>F-TERM-01 |
| **M3: 完整 Agent 功能** | Week 2 前 3 天 | 4. Agent 复杂上下文（带关联）<br>5. Terminal 配置 Workspace<br>6. Agent 命令解析和执行<br>7. Terminal 使用 Agent 模式 | ✓ Agent 可读取 `Block.children` 中的 reference 关系<br>✓ Terminal workspace_mount 可导出物理文件<br>✓ `agent.approve` 可解析 Proposal 并执行 Commands<br>✓ Terminal 可配置 Agent 调用方式（API/Terminal） | B-AGENT-08～11<br>B-TERM-04～06<br>B-REL-03 |
| **M4: Relation 可视化** | Week 2 第 4-5 天 | 8. Relation 前端显示 | ✓ RelationGraph 组件渲染 DAG<br>✓ 节点点击跳转 Block<br>✓ 支持 reference/implement 关系展示 | F-REL-01～03<br>B-REL-04～05 |
| **M5: Dogfooding 追踪计划** | Week 2 结束 | 产品输出 Dogfooding 追踪计划，研发准备 Dogfooding 环境 | ✓ 产品完成 Dogfooding 场景设计<br>✓ 产品完成效果追踪指标定义<br>✓ 研发完成 Agent + Terminal + Relation 基础集成测试 | P-DOG-01<br>T-INT-01～02 |
| **M6: Event 逻辑整理** | Week 3 前 2 天 | 9. 通过 Relation 进行 Event 整理，梳理逻辑关系 | ✓ RelationGraph 可追溯 Event 因果关系<br>✓ 支持按 Relation 筛选 Event<br>✓ Dogfooding 场景中可查看决策链条 | B-REL-04（扩展）<br>F-REL-03（扩展） |
| **M7: Dogfooding 执行** | Week 3 第 3-4 天 | 产品执行 Dogfooding，研发修复问题 | ✓ 产品完成 Dogfooding 场景 2<br>✓ 研发修复 P0 Bug<br>✓ 收集优化需求 | P-DOG-02<br>T-E2E-01 |
| **M8: 上下文优化** | Week 3 第 5 天 | 10. Agent 上下文优化算法（Event 逻辑裁剪） | ✓ Token 截断策略基于 Event 逻辑关系<br>✓ 优先保留因果链关键 Block<br>✓ Dogfooding 验证上下文质量提升 | B-AGENT-11（优化）<br>P-DOC-02 |

---

### 4.2 产研协作时间线

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         Phase 2 产研协作时间线（3 周）                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Week 0（准备周）                                                            │
│  ┌───────────────────┐                                                     │
│  │ 产品：用户研究和聚焦 │                                                     │
│  │   - 竞品分析       │                                                     │
│  │   - 交互规范输出   │                                                     │
│  └───────────────────┘                                                     │
│           │                                                                │
│           v                                                                │
│  Week 1（基础开发周）                                                         │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 1-3: M1 基础功能就绪            │                                      │
│  │   研发：Terminal + Agent + Relation│                                     │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 4-5: M2 Agent-Terminal 交互验证│                                      │
│  │   产品 + 研发：联合验证基础交互      │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  Week 2（完整功能周）                                                         │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 1-3: M3 完整 Agent 功能        │                                      │
│  │   研发：上下文、Workspace、Proposal │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 4-5: M4 Relation 可视化        │                                      │
│  │   研发：RelationGraph UI           │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Week 2 末: M5 Dogfooding 追踪计划  │                                      │
│  │   产品：场景设计 + 指标定义         │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  Week 3（优化与验证周）                                                       │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 1-2: M6 Event 逻辑整理         │                                      │
│  │   研发：Relation 追溯 Event        │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 3-4: M7 Dogfooding 执行        │                                      │
│  │   产品：执行场景 2                 │                                      │
│  │   研发：修复 Bug                   │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 5: M8 上下文优化               │                                      │
│  │   研发：Event 逻辑裁剪             │                                      │
│  │   产品：Dogfooding 报告输出        │                                      │
│  └──────────────────────────────────┘                                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 关键依赖关系

| 依赖关系 | 说明 | 影响范围 |
| :--- | :--- | :--- |
| **M1 → M2** | Agent 基本配置 + Terminal cwd 完成后才能验证交互 | Week 1 Day 4-5 |
| **M2 验证通过 → M3** | 交互验证不通过需返工，影响 M3 排期 | Week 2 Day 1 |
| **RelationGraph (M1) → Agent 上下文 (M3)** | Agent 读取 Block.children 依赖 Relation 双向索引 | Week 2 Day 1-3 |
| **Agent Proposal (M3) → Relation Event 整理 (M6)** | Event 逻辑整理依赖 Proposal 生成完整 Event | Week 3 Day 1-2 |
| **M3 + M4 → M5** | Dogfooding 追踪计划依赖 Agent 和 Relation 功能就绪 | Week 2 末 |
| **M5 追踪计划 → M7 执行** | 产品 Dogfooding 执行依赖追踪计划和场景设计 | Week 3 Day 3-4 |
| **M6 Event 整理 → M8 上下文优化** | 上下文优化算法依赖 Event 逻辑关系能力 | Week 3 Day 5 |

**风险依赖**:
- **M2 交互验证** 是关键节点，验证不通过会导致 Week 2 返工
- **M5 Dogfooding 追踪计划** 必须在 Week 2 末完成，否则影响 M7 执行
- **Terminal Workspace 同步 (M3)** 涉及文件监听，可能延期，需降级为手动同步

---

## 五、风险预留与缓冲

### 5.1 历史风险回顾

**Phase 1 开发风险**：
- 在涉及 Core 和 Engine 核心模块时，实际耗时是预估的 **2 倍**
- 主要原因：架构设计调整、Event Sourcing 理解成本、CBAC 权限模型复杂度

**Phase 1 产品风险**：
- 实验方向调整导致返工，产品需求变更频繁
- 用户研究结论与初始假设不符，需要重新设计

### 5.2 Phase 2 风险评估

**开发侧风险**：
1. **规范化改善**：Phase 2 已引入开发规范（CLAUDE.md + Extension 指南 + 前后端开发规范 + 开发流程），预计可减少 30% 返工
2. **新的风险点**：
   - **F2 文件同步机制（高风险）**：涉及文件监听（notify crate）、自动同步覆盖 block、冲突检测，复杂度高，预计耗时可能是预估的 1.5-2 倍
   - LLM API 集成的不确定性（流式输出、错误处理）
   - Proposal 机制的复杂状态管理
   - RelationGraph 性能优化需求
3. **规范修改风险**：严格遵守规范可能导致灵活性不足，需要根据实际情况调整规范本身

**产品侧风险**：
1. **Dogfooding 发现核心假设不成立**：如果 Proposal 首次通过率 < 40%，需要重新设计交互
2. **竞品分析结论影响方向**：可能需要调整 Agent 能力范围
3. **用户研究结论与预期不符**：需要快速迭代 UI 方案

### 5.3 风险预留策略

**总预算**: 268 人时（研发 183 + 产品 85）
**总工期**: 3 周（约 270-285 人时，5 人团队）
**风险预留**: 32-57 人时（约 12-21% 缓冲）

**预算调整说明**: 相比初始规划增加 11 人时（M6/M8 里程碑任务），风险预留相应减少

| 风险类型 | 预留时间 | 应对策略 |
| :--- | :--- | :--- |
| **LLM 集成调试** | 8-12 人时 | 优先实现 Mock 测试，延后真实 API 调用 |
| **文件同步机制复杂度** | 10-15 人时 | F2 涉及文件监听、冲突检测，是高风险点。优先实现单向同步，双向同步推迟 |
| **Event 逻辑优化算法** | 6-10 人时 | M6/M8 新增任务，算法复杂度不确定。优先实现简单版本，高级优化推迟到 Phase 3 |
| **规范修改返工** | 5-10 人时 | 每周一次规范评审，快速调整 |
| **产品方向调整** | 3-10 人时 | Week 2 初进行中期评审，及时止损 |

**风险应对原则**：
- **Week 1 结束（M1-M2）**：评估 Relation + Terminal + Agent 基础功能，M2 交互验证不通过需立即返工
- **Week 2 结束（M3-M5）**：评估 Agent Proposal 效果和 Relation 可视化，M5 Dogfooding 追踪计划必须完成
- **Week 3 Day 2（M6）**：评估 Event 逻辑整理效果，不成熟则降级为简单版本（仅显示直接关联 Event）
- **Week 3 Day 5（M8）**：评估上下文优化算法效果，复杂度高则推迟到 Phase 3
- **降级策略**：
  - **F2 文件同步**：降级为手动触发同步（"Sync to Block" 按钮）
  - **M8 上下文优化**：降级为基于时间的简单截断（B-AGENT-11）

---

## 六、产研协作流程

### 6.1 协作时间线

```
┌────────────────────────────────────────────────────────────────────┐
│                      二阶段产研协作流程                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Week 0                                                            │
│  ┌──────────────────────┐                                          │
│  │ 产品：完成summary报告 │───────────┐                              │
│  └──────────────────────┘           │                              │
│                                     v                              │
│  Week 1                    ┌─────────────────────┐                 │
│  ┌────────────────────┐    │ 研发：评审规范可行性  │                 │
│  │ 产品：输出交互规范  │───>│ 研发：开始后端开发    │                 │
│  └────────────────────┘    └─────────────────────┘                 │
│                                     │                              │
│  Week 2                             v                              │
│  ┌────────────────────┐    ┌─────────────────────┐                 │
│  │ 产品：参与 Dogfooding│<──│ 研发：交付最小可用版本│                 │
│  │      记录问题      │    └─────────────────────┘                 │
│  └────────────────────┘                                            │
│           │                                                        │
│  Week 3   v                                                        │
│  ┌────────────────────┐    ┌─────────────────────┐                 │
│  │ 产品：输出 UI 迭代方案│──>│ 研发：迭代优化 UI     │                │
│  └────────────────────┘    └─────────────────────┘                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 关键协作机制

| 机制 | 描述 |
| :--- | :--- |
| **契约文档** | 产品输出的「交互规范」是研发的需求输入 |
| **灰度交付** | 研发每完成一个 Story，立即交付给产品体验 |
| **问题清单制** | 产品在 Dogfooding 过程中维护「问题清单」，研发按优先级处理 |

### 6.3 产研协作的输入输出

| 阶段 | 产品输入 | 研发输入 | 产品输出 | 研发输出 |
| :--- | :--- | :--- | :--- | :--- |
| **Week 0** | product_summarize.md | - | 交互规范（Agent/Terminal/Relation） | - |
| **Week 1** | 交互规范 | CLAUDE.md + 技术规范 | - | 后端基础功能（Relation + Terminal） |
| **Week 2** | 最小可用版本 | 产品反馈 | 问题清单（优先级排序） | Agent Proposal 功能 + 前端 UI |
| **Week 3** | 问题清单 | UI 迭代方案 | Dogfooding 报告 + 竞品分析 | P0 功能完成 + Bug 修复 |