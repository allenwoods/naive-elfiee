# Phase 2 协作设计方案 v2 (Agent & Terminal)

**创建日期**: 2026-01-08
**状态**: 规划完成，待开发
**目标**: 实现 Agent 辅助开发和 Terminal 环境隔离，满足 Dogfooding 需求

---

## 一、核心设计回顾与核对

### 1.1 现有实现状态核对

| 功能模块 | 现有实现 | 设计契合度 | 结论 |
|----------|---------|------------|------|
| **Directory Block** | `directory.import` 正确推断文件类型，并在 `metadata` 中记录了 `external_root_path`。 | ✅ 完全契合 | 可以作为 Terminal 外部模式的基础 |
| **Path Injection** | `BlockMetadata` 支持 `custom` 字段，且 `directory.import` 已写入路径。 | ✅ 完全契合 | 无需修改现有 Directory 实现 |
| **Terminal** | 仅支持基础 PTY，`cwd` 为外部路径，不支持 Block 关联。 | ❌ 需要重构 | 需要区分内部/外部模式 |
| **Relation** | 仅有单向 `children` 字段。 | ⚠️ 需要增强 | 需要双向索引支持因果链 |

### 1.2 核心设计原则

1.  **Agent 是"配置 + 身份"**：Agent Block 存储配置，关联一个独立的 Editor ID。Agent 本身只是字段，通过 Editor 身份在 EventStore 中留下记录。
2.  **Terminal 双模式**：
    *   **内部模式 (Internal)**：工作在 Elfiee 内部，用于编写脚本和临时任务。
    *   **外部模式 (External)**：工作在外部系统目录（通过关联 Directory Block），用于运行测试和编译。
3.  **Event Sourcing 优先**：
    *   Agent 操作生成 Proposal Event，批准后生成独立 Execution Events。
    *   Terminal 操作生成 `terminal.execute` 和 `terminal.output` Events。

---

## 二、功能模块设计

### 2.1 Agent Block Extension

#### A. 数据结构

Agent Block 实际上是一个配置容器，核心是通过关联的 Editor ID 来行动。

```rust
// Block Type: ai_agent
pub struct AgentBlock {
    // ... 标准 Block 字段 ...
    pub contents: AgentConfig,
}

#[derive(Serialize, Deserialize, Type)]
pub struct AgentConfig {
    // 身份关联
    pub editor_id: String,  // 创建时自动生成: "agent-<uuid>"

    // AI 模型配置
    pub provider: String,           // "anthropic" | "openai"
    pub model: String,              // "claude-sonnet-4-5"
    pub api_key_env: String,        // "ANTHROPIC_API_KEY"
    pub system_prompt: String,
}
```

#### B. 关系定义

Agent 通过 `children` 字段定义其"工具箱"和"产出物"：

```javascript
Agent Block (a1)
├── children
│   ├── reference: [t1]      // Agent 可以使用的 Terminal
│   ├── reference: [b1]      // Agent 可以读取的 Directory Block
│   └── implement: []        // Agent 生成的代码 Block (动态添加)
```

#### C. 工作流：Proposal 机制

为了保持 Event Sourcing 的纯洁性，Agent 的调用分为两步：

1.  **AI 思考 (Proposal)**：生成建议，不修改状态。
2.  **执行 (Execution)**：用户/系统批准，生成实际修改 Event。

**Capability: `ai_agent.invoke`**

*   **输入**: Prompt
*   **处理**:
    1.  调用 LLM API
    2.  解析返回的结构化 XML/JSON
    3.  生成 `ai_agent.invoke` Event，包含 `proposed_commands`
*   **输出**: Event (记录事实："AI 建议做这些操作")

**执行流程**:

```
[前端] 用户点击 "Approve"
   ↓
[前端] 解析 proposal 中的 commands
   ↓
[前端] 依次调用 Tauri Client:
   ├─ block.create(pdf.rs)  → editor_id = agent_id
   ├─ code.write(...)       → editor_id = agent_id
   └─ core.link(...)        → editor_id = agent_id
```

---

### 2.2 Terminal Block Extension (重构)

#### A. 数据结构（简化）

Terminal 采用**单一模式 + 可选关联**，不引入复杂的内外部切换。

```rust
// Block Type: terminal
pub struct TerminalConfig {
    pub shell: String,
    pub env: HashMap<String, String>,
    
    // 可选：关联的 Directory Block
    // 如果设置，Terminal 的默认 cwd = dir.metadata.external_root_path
    // 否则，cwd = terminal block 的目录
    pub linked_directory_id: Option<String>,
}
```

**工作目录解析逻辑**：

```rust
fn get_terminal_cwd(terminal_block: &Block, state: &StateProjector) -> PathBuf {
    let config: TerminalConfig = parse_contents(terminal_block)?;
    
    if let Some(dir_id) = &config.linked_directory_id {
        // 关联 Directory：使用外部路径
        let dir_block = state.get_block(dir_id)?;
        let external_path = dir_block.metadata.custom
            .get("external_root_path")
            .ok_or("Directory Block has no external_root_path")?;
        PathBuf::from(external_path)
    } else {
        // 独立模式：使用 Terminal Block 自己的目录
        get_block_dir(&terminal_block.block_id)
    }
}
```

#### B. 导出同步策略（Phase 2: 手动）

**问题**：Terminal 在外部目录运行测试时，需要先导出 Block 内容。

**Phase 2 方案**：手动提示 + Session 记忆

```typescript
// 前端：Terminal 执行命令前的逻辑
async function executeTerminalCommand(terminalId: string, command: string) {
    const terminal = await TauriClient.block.get(terminalId);
    const linkedDirId = terminal.contents.linked_directory_id;
    
    if (linkedDirId) {
        // 检查用户偏好（Session 级别）
        const pref = sessionStorage.getItem(`terminal-${terminalId}-export`);
        
        if (pref === 'always') {
            await TauriClient.directory.export(linkedDirId);
        } else if (pref !== 'never') {
            // 显示提示
            const result = await showDialog({
                title: "导出到外部目录？",
                message: "Terminal 将在外部项目目录运行，建议先导出最新修改。",
                options: [
                    { label: "导出并运行", value: "export" },
                    { label: "直接运行（跳过导出）", value: "skip" },
                    { label: "取消", value: "cancel" }
                ],
                rememberChoice: true  // 提供"记住选择"选项
            });
            
            if (result.value === 'export') {
                await TauriClient.directory.export(linkedDirId);
                if (result.remember) {
                    sessionStorage.setItem(`terminal-${terminalId}-export`, 'always');
                }
            } else if (result.value === 'cancel') {
                return;
            } else if (result.remember) {
                sessionStorage.setItem(`terminal-${terminalId}-export`, 'never');
            }
        }
    }
    
    // 执行命令
    await TauriClient.terminal.execute(terminalId, command);
}
```

**Phase 3+ 改进**：
- 自动检测 dirty blocks（对比 `metadata.updated_at` 和 `last_export`）
- 文件监听（`notify` crate）实现双向同步
- 冲突检测和合并 UI

**类比**：
- Phase 2 ≈ Git 模型（手动 commit/push）
- Phase 3 ≈ VS Code 模型（自动保存 + 文件监听）

---

### 2.3 Relation 系统 (增强)

#### A. 核心 Relation 类型

| 类型 | 语义 | 示例 |
| :--- | :--- | :--- |
| `reference` | 引用/调用 | Agent → Terminal, Markdown → Code |
| `implement` | 实现/产出 | Requirement → Code, Code → Test |

#### B. 存储与索引分离

**存储层（EventStore）**：
- `Block.children: HashMap<String, Vec<String>>` 保持**单向 DAG**
- 支持环检测（添加 link 前检查）
- 这是"事实"，存储在 Event Log 中

**索引层（内存）**：
- `StateProjector` 维护 `RelationGraph`，从 `Block.children` 派生
- 提供**反向索引**，加速"谁引用了我"查询
- 这是"缓存"，每次 `apply_event` 时重建

```rust
pub struct RelationGraph {
    // 正向：source -> [(target, relation)]
    // 直接从 Block.children 复制
    outgoing: HashMap<String, Vec<(String, String)>>,
    
    // 反向：target -> [(source, relation)]
    // 从 Block.children 派生，用于加速查询
    incoming: HashMap<String, Vec<(String, String)>>,
}

impl StateProjector {
    // 环检测基于 Block.children，不受索引影响
    fn check_cycle(&self, source: &str, target: &str) -> bool {
        // DFS/BFS on Block.children
    }
    
    // API: 查询父节点（利用反向索引）
    pub fn get_parents(&self, block_id: &str) -> Vec<BlockRelation> {
        self.relation_graph.incoming.get(block_id)
    }
    
    // API: 查询子节点（直接读 Block.children）
    pub fn get_children(&self, block_id: &str) -> Vec<BlockRelation> {
        self.blocks.get(block_id)?.children
    }
}
```

---

## 三、用户故事演练 (Dogfooding)

**场景**: 使用 Agent 为 Elfiee 开发 "PDF 导出" 功能。

1.  **环境准备**
    *   创建 `Directory Block (b1)`，Import Elfiee 项目。
        *   *Result*: `b1` 记录 `external_path`, 内容为当前源码快照。
    *   创建 `Terminal Block (t1)`，模式 External，关联 `b1`。
    *   创建 `Agent Block (a1)`，关联 `t1` 和 `b1`。

2.  **需求定义**
    *   创建 `Markdown Block (f1)`，写入需求。

3.  **Agent 开发**
    *   用户对 `a1` 说："根据 f1 实现 PDF 导出"。
    *   `a1` 读取 `f1` 需求和 `b1` 代码结构。
    *   `a1` 生成 Proposal:
        *   `create block src/pdf.rs`
        *   `write code ...`
        *   `link f1 -> pdf.rs (implement)`
    *   用户 **Approve**。
    *   系统执行操作，`b1` 中新增了文件 Block (内存中)。

4.  **运行测试**
    *   用户在 Terminal `t1` 输入 `cargo test pdf`。
    *   系统检测到 `b1` 有新文件未导出。
    *   用户点击 "Export & Run"。
    *   系统执行 `directory.export` (覆盖外部文件)。
    *   Terminal 在外部目录运行测试。

5.  **提交**
    *   测试通过。
    *   用户在外部终端 `git commit`。

---

## 四、开发任务清单

### Phase 2.1: 基础设施 (Week 1)

*   [ ] **Relation增强**: 实现 `RelationGraph` 索引及 Tauri 查询接口。
*   [ ] **Terminal重构**:
    *   [ ] 实现 `TerminalConfig` (Internal/External 模式)。
    *   [ ] 实现 External 模式下的 CWD 解析 (读取关联 Directory 的 metadata)。
    *   [ ] 实现 `terminal.execute/output` 的 Event 记录。

### Phase 2.2: Agent 核心 (Week 2)

*   [ ] **Agent Block**:
    *   [ ] 定义数据结构和 `ai_agent.create` (自动创建 Editor)。
    *   [ ] 实现 `ai_agent.invoke` 生成 Proposal Event。
    *   [ ] 实现 LLM API 调用封装。
*   [ ] **前端集成**:
    *   [ ] Agent 对话 UI & Proposal 审批流。
    *   [ ] 执行 Approved Commands 的逻辑。

### Phase 2.3: 去中心化准备 (Week 3)

*   [ ] **Identity**: 引入 Node ID (`~/.elfiee/node_id`)。
*   [ ] **Event**: 扩展 Vector Clock Key 为 `node_id:editor_id`。

---

*注：本设计文档基于 v1 讨论优化，删除了复杂的 Symlink Forest 和 临时工作目录方案，采用更轻量的 External 模式和 Proposal 机制。*
