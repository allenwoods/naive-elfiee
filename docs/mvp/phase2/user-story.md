# User Stories: Agent Automation & Decentralization Foundation (Phase 2-3)

**Document Status**: Draft
**Based on**:
- `agent&terminal-design-v2.md`
- `collaboration-design.md`

---

## 1. 开发目标

本阶段旨在通过 **Dogfooding (吃狗粮)** 的方式，在 Elfiee 内部构建并验证 "AI Agent 辅助开发" 的完整闭环。同时，为未来的"去中心化离线协作"打下必要的数据结构基础。

核心目标：
1.  **实现 Agent 辅助的闭环开发**：从需求到代码实现，再到测试运行，Agent 能以"具身"（Embodied）的方式参与其中。
2.  **打通 Internal/External 环境**：解决 Elfiee 内部 Block 与外部文件系统/工具链（如 Cargo, Node.js）的交互问题。
3.  **建立因果追踪机制**：记录 Agent 的思考过程（Proposal）和修改依据（Relation）。
4.  **准备去中心化身份**：确保多人/多 Agent 环境下的数据一致性和无冲突合并。

---

## 2. 覆盖阶段

本计划覆盖原定开发路线图的 **Phase 2 (人与AI协作)** 和 **Phase 3 (逻辑链条)** 的部分核心能力，并为 Phase 6 做底层铺垫。

| 阶段 | 聚焦点 | 对应技术模块 |
| :--- | :--- | :--- |
| **Phase 2.1: 基础设施** | 外部环境打通 | Terminal External Mode, Directory Import/Export |
| **Phase 2.2: Agent 核心** | AI 行为规范 | Agent Block, Proposal Mechanism, Editor Identity |
| **Phase 2.3: 去中心化基石** | 数据唯一性 | Node ID, Extended Vector Clock Key |

---

## 3. 用户流程 (The "Dogfooding" Story)

**场景**：开发者使用 Elfiee 的 Agent 能力，为 Elfiee 项目本身开发 "PDF 导出" 功能。

1.  **环境挂载 (Setup)**
    *   开发者创建一个 `Directory Block`，导入 Elfiee 源码。
    *   开发者创建一个 `Terminal Block`，设置为 **External Mode** 并关联上述 Directory。
    *   开发者创建一个 `Agent Block` (e.g., "DevBot")，并授予其访问 Terminal 和 Directory 的权限。

2.  **需求下达 (Input)**
    *   开发者在白板上编写 `Markdown Block`："我们需要支持将当前文档导出为 PDF，请实现相关 Rust 模块"。
    *   开发者 @DevBot 并指向需求 Block。

3.  **Agent 思考与提案 (Proposal)**
    *   DevBot 读取需求和项目代码结构。
    *   DevBot 生成一个 **Proposal**："我建议创建 `src/pdf.rs`，并在 `Cargo.toml` 添加依赖"。
    *   开发者查看 Proposal，确认无误后点击 **Approve**。

4.  **自动执行 (Execution)**
    *   系统以 "DevBot" 的身份，在编辑器中创建了 `pdf.rs` Block 并写入代码。
    *   系统自动创建 **Relation**：`pdf.rs` (implement) -> `Markdown Requirement`。

5.  **验证与交付 (Verification)**
    *   开发者在关联的 Terminal 中输入 `cargo test pdf`。
    *   系统提示"有新 Block 未导出"，用户选择 "Export & Run"。
    *   Block 内容覆盖到外部磁盘，测试开始运行。
    *   测试通过，用户在 Terminal 中执行 `git commit`。

---

## 4. 用户故事 (User Stories)

我们将上述大流程拆解为独立的、可交付的用户故事。

### Group A: 终端与环境 (Terminal & Environment)

#### Story 1: 外部模式终端
> As a **Developer**, I want to run a terminal that executes commands in an external directory linked to a Directory Block, so that I can use my existing toolchain (cargo, npm).
*   **Acceptance Criteria**:
    *   Terminal Block 可以配置 `linked_directory_id`。
    *   Terminal 启动时 `cwd` 自动设为关联 Directory 的 `external_root_path`。

#### Story 2: 运行前导出检查
> As a **Developer**, I want the system to remind me to export modified blocks before running commands in the terminal, so that I'm testing the latest code.
*   **Acceptance Criteria**:
    *   Terminal 执行命令前，检测关联的 Block 是否有未导出变更。
    *   弹出对话框：Export & Run / Run / Cancel。
    *   支持 "Always remember" 选项。

### Group B: Agent 交互 (Agent Interaction)

#### Story 3: Agent 身份与配置
> As a **User**, I want to configure an Agent Block with a specific Model (e.g., Claude 3.5) and System Prompt, so it can act as a specialized role.
*   **Acceptance Criteria**:
    *   Agent Block 包含 Provider/Model/Prompt 配置。
    *   Agent 创建时自动获得唯一的 `editor_id` (e.g., `agent-{uuid}`)。

#### Story 4: 上下文感知 (Context Awareness)
> As an **Agent**, I want to read the content of Blocks linked to me via `children` relations, so I have the necessary context to solve tasks.
*   **Acceptance Criteria**:
    *   Agent 可以读取关联的 Directory Block 的文件列表。
    *   Agent 可以读取关联的 Terminal Block 的输出（如错误报错）。

#### Story 5: 提案-批准机制 (Proposal Workflow)
> As a **User**, I want to review the Agent's planned actions (Create Block, Write Code) before they happen, so I maintain control over the project.
*   **Acceptance Criteria**:
    *   Agent 的输出是一个结构化的 `Proposal Event`。
    *   UI 展示 Proposal 详情（Diff View）。
    *   用户点击 Approve 后，系统才生成实际的 `block.create` / `code.write` Event。

### Group C: 关系与追踪 (Relation & Traceability)

#### Story 6: 自动建立因果关系
> As a **System**, I want to automatically record relations when an Agent creates content based on a requirement, so I can visualize the logic chain later.
*   **Acceptance Criteria**:
    *   当 Agent 根据 Block A 创建 Block B 时，自动添加 `B -> A (implement)` 的关系。
    *   关系数据存储在 Block 的 children 字段中。

### Group D: 协作基础 (Collaboration Foundation)

#### Story 7: 唯一节点标识
> As a **User**, I want my device to have a unique Node ID, so that my offline edits don't conflict with others even if we use similar Editor IDs.
*   **Acceptance Criteria**:
    *   系统首次启动生成 `~/.elfiee/node_id`。
    *   所有 Event 的 Vector Clock key 格式升级为 `node_id:editor_id`。

#### Story 8: 逻辑时钟防冲突
> As a **System**, I want to distinguishing events from different devices using the extended Vector Clock key, so that merge conflicts are correctly identified.
*   **Acceptance Criteria**:
    *   EventStore 能正确解析和存储 `node_id:editor_id` 格式的 Key。
    *   现有 CBAC 鉴权逻辑不受影响（只识别 editor_id 部分）。
