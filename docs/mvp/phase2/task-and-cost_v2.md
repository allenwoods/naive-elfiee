# Phase 2 任务规划与预算（v2）

## 一、总体预算概览

### 1.1 预算分配

| 角色类型 | 总预算（人时） | 占比 | 说明 |
| :--- | :--- | :--- | :--- |
| **研发团队** | 195 人时 | 70% | 后端 + 前端 + 测试 |
| **产品团队** | 55 人时 | 20% | Dogfooding 实验 + 指标 + 归因 |
| **缓冲预留** | 30 人时 | 10% | 风险应对 |
| **总计** | 280 人时 | 100% | 约 3 周（每周 90-95 人时） |

### 1.2 功能范围

**研发功能（10 个 + 2 个可选）**：
- Skills/CLI 模块：F1 (P0), F2 (P0), F3 (P0), F3.5 elfiee-ext-gen 改造 (P0)
- Session 模块：F4 (P0), F5 (P0), F6 (P1)
- Git 模块：F7 (P0), F8 (P1), F9 (P1)
- Agent 模块：F10 (P0)
- 可选：Event 增量 Diff (P2)

**产品研究（3 个）**：
- R1 Dogfooding 实验设计 (P0)
- R2 评价指标定义 (P0)
- R3 归因分析方法 (P0)

---

## 二、研发任务规划（195 人时）

### 2.1 后端开发（125 人时）

#### 2.1.1 文件系统与启动模块（18 人时）

**文件结构**: `src-tauri/src/commands/` + `src-tauri/src/engine/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-FS-01** | .elf 目录结构初始化 | `commands/elf_file.rs` | 创建/打开 .elf 时自动生成 `.elf/` 元数据目录：`SKILLS.md`, `projects/`, `git/hooks/`。如果不存在则创建，存在则跳过 | 4 | Step 1 |
| **B-FS-02** | 通用 SKILLS.md 模板内置 | `templates/skills.md` (新建) | 内置通用 SKILLS.md 模板，包含 core.create, markdown.write, code.write, core.link 等基础命令格式 | 3 | Step 1 |
| **B-FS-03** | .elf/ 目录置顶展示 | `commands/block.rs` | 修改 Block 列表查询，将 `.elf/` 目录下的 Blocks 置顶展示，与普通内容区分 | 3 | Step 1 |
| **B-FS-04** | 项目导入时创建项目级目录 | `extensions/directory/directory_import.rs` | `directory.import` 时自动在 `.elf/projects/{project-name}/` 下创建 `SKILLS.md` 和 `CLAUDE.md` | 4 | Step 2 |
| **B-FS-05** | external_path 去重优化 | `extensions/directory/directory_import.rs` | 修复 external_path 重复存储问题，只在 metadata 中存储 `external_root_path`，entry 级别路径运行时计算 | 4 | Step 2 |

#### 2.1.2 Skills/CLI 模块（35 人时）

**文件结构**: `src-tauri/src/cli/` (新建模块) + `elfiee-ext-gen/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-CLI-01** | CLI 入口模块 | `src-tauri/src/cli/mod.rs` (新建) | 创建 CLI 入口，解析命令行参数：`elfiee --agent {id} {capability} {args}`，支持 `--project` 指定 .elf 文件路径 | 4 | F3 |
| **B-CLI-02** | CLI-Engine IPC 通信 | `src-tauri/src/cli/ipc.rs` (新建) | 实现 CLI 与运行中 Elfiee 的 IPC 通信：使用 Unix Socket（Linux/Mac）或 Named Pipe（Windows），查找运行中的 Engine 实例 | 6 | F3 |
| **B-CLI-03** | CLI 直接操作模式 | `src-tauri/src/cli/direct.rs` (新建) | 如果 Elfiee 未运行，CLI 直接操作 .elf 文件（SQLite），打开 Engine、执行命令、关闭 | 5 | F3 |
| **B-CLI-04** | CLI 输出格式化 | `src-tauri/src/cli/output.rs` (新建) | 支持 JSON 输出（`--json`）和人类可读输出，返回 block_id、执行状态等 | 3 | F3 |
| **B-CLI-05** | Skills 生成器 | `src-tauri/src/commands/skills.rs` (新建) | 实现 `generate_skills` 命令：扫描注册的 Capabilities，生成 SKILLS.md 格式，支持通用/项目级/Agent 级合并 | 5 | F1 |
| **B-CLI-06** | Symlink 管理器 | `src-tauri/src/commands/symlink.rs` (新建) | 实现 `create_skills_symlink` 和 `remove_skills_symlink`：检测 `~/.claude/skills/` 目录，创建/删除 symlink | 4 | F2 |
| **B-CLI-07** | elfiee-ext-gen 协议层改造 | `elfiee-ext-gen/src/generator.rs` | 将原有直接生成代码逻辑改为调用 Elfiee CLI：`create` → `elfiee core.create` + `elfiee code.write`，支持 `--dry-run` 预览 | 5 | F3.5 |
| **B-CLI-08** | elfiee-ext-gen 导出集成 | `elfiee-ext-gen/src/export.rs` (新建) | 生成代码后自动调用 `directory.export`，将 Block 内容导出到物理文件，支持 `--no-export` 跳过 | 3 | F3.5 |

#### 2.1.3 Agent 模块（22 人时）

**文件结构**: `src-tauri/src/extensions/agent/` (扩展现有模块)

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-AGENT-01** | Claude Session 扫描器 | `extensions/agent/session_scanner.rs` (新建) | 扫描 `~/.claude/projects/` 目录，解析活跃的 session 文件（.jsonl），提取 session_id、project_path、最后活跃时间 | 5 | F10 |
| **B-AGENT-02** | Agent 关联命令 | `extensions/agent/agent_link.rs` (新建) | 实现 `agent.link_session` capability：用户选择 session_id，创建 Agent Block，设置 `editor_id = {provider}:{session_id}` | 4 | F10 |
| **B-AGENT-03** | Agent Block 目录生成 | `extensions/agent/agent_create.rs` (修改) | Agent Block 创建时自动生成 `blocks/agent-{uuid}/` 目录，包含 `config.json`、合并后的 `SKILLS.md`、`hooks/` | 4 | F10 |
| **B-AGENT-04** | Agent SKILLS 合并 | `extensions/agent/skills_merger.rs` (新建) | 实现 SKILLS 合并逻辑：通用 SKILLS + 项目级 SKILLS → Agent 的 SKILLS.md，处理命令冲突 | 4 | F10 |
| **B-AGENT-05** | Agent Symlink 自动化 | `extensions/agent/agent_create.rs` (扩展) | Agent 创建完成后自动调用 `create_skills_symlink`，将 Agent 的 SKILLS.md 链接到 `~/.claude/skills/` | 3 | F2, F10 |
| **B-AGENT-06** | 注册 Agent 命令 | `lib.rs` + `commands/agent.rs` | 在 Tauri 中注册 `scan_claude_sessions`、`link_agent_session` 命令，导出 Payload 类型 | 2 | F10 |

#### 2.1.4 Session 同步模块（25 人时）

**文件结构**: `src-tauri/src/sync/` (新建模块)

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-SYNC-01** | JSONL 文件监听器 | `sync/watcher.rs` (新建) | 使用 `notify` crate 监听 `~/.claude/projects/{project}/{session}.jsonl` 文件变化，触发同步回调 | 5 | F4 |
| **B-SYNC-02** | JSONL 解析器 | `sync/parser.rs` (新建) | 解析 Claude Code 的 JSONL 格式，提取 `tool_use` 记录、用户消息、Claude 响应，返回结构化数据 | 4 | F4 |
| **B-SYNC-03** | 增量解析优化 | `sync/parser.rs` (扩展) | 记录上次解析位置（文件偏移量），只解析新增内容，避免重复处理 | 3 | F4 |
| **B-SYNC-04** | Session Log Block 创建 | `sync/log_writer.rs` (新建) | 同步时自动创建/更新 `session/log-{timestamp}.md` Block，使用 `markdown.write` 追加会话内容 | 4 | F5 |
| **B-SYNC-05** | 时序保证机制 | `sync/log_writer.rs` (扩展) | 确保会话内容的 Event 在代码变更的 Event 之前：先写入 session log，再执行 tool_use 对应的命令 | 4 | F5 |
| **B-SYNC-06** | Session-Task 关联 | `sync/relation.rs` (新建) | 检测 task.md 和 session，建立 `session-log → task.md (tracks)` relation，双重校验新任务和新 session | 3 | F6 |
| **B-SYNC-07** | 注册同步命令 | `lib.rs` + `commands/sync.rs` | 在 Tauri 中注册 `start_session_sync`、`stop_session_sync`、`sync_session_manually` 命令 | 2 | F4-F6 |

#### 2.1.5 Git 集成模块（25 人时）

**文件结构**: `src-tauri/src/git/` (新建模块)

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-GIT-01** | Hooks 复制器 | `git/hooks.rs` (新建) | 导入项目时复制原 `.git/hooks/` 到 `.elf/git/hooks/`，在复制的 hooks 中追加 Elfiee 检查逻辑 | 5 | F8 |
| **B-GIT-02** | core.hooksPath 管理 | `git/hooks.rs` (扩展) | 实现 `set_hooks_path` 和 `unset_hooks_path`：打开项目时设置 `git config core.hooksPath`，关闭时恢复 | 4 | F8 |
| **B-GIT-03** | Task 信息提取 | `git/task_parser.rs` (新建) | 从 task.md Block 提取 title（→分支名）和 content（→commit message），支持 Markdown 解析 | 3 | F7 |
| **B-GIT-04** | 一键导出+提交 | `git/commit.rs` (新建) | 实现 `export_and_commit` 命令：调用 `directory.export` → 创建分支 → git add → git commit，可选 push | 6 | F7 |
| **B-GIT-05** | Merge 检测器 | `git/merge_detector.rs` (新建) | 监听 git reflog 或定期检查，检测本地 merge 事件，触发归档回调 | 4 | F9 |
| **B-GIT-06** | 归档文档生成 | `git/archive.rs` (新建) | 实现 `generate_archive` 命令：按 Event 时间顺序汇总对话+编辑 Events，生成 Myst 格式的 summary markdown | 5 | F9 |
| **B-GIT-07** | 注册 Git 命令 | `lib.rs` + `commands/git.rs` | 在 Tauri 中注册 `export_and_commit`、`generate_archive`、`set_hooks_path` 等命令 | 2 | F7-F9 |

#### 2.1.6 Event 增强模块（可选，P2）

**文件结构**: `src-tauri/src/engine/` (引擎级别)

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-EVT-01** | 增量 Diff 存储 | `engine/event_store.rs` (修改) | Event 的 value 字段支持存储增量 diff 而非全量内容，使用 `similar` crate 计算文本 diff | 6 | 可选 |
| **B-EVT-02** | Diff 重放器 | `engine/state.rs` (修改) | StateProjector 支持从增量 diff 重建完整内容，实现 `apply_diff` 和 `reconstruct_content` | 6 | 可选 |
| **B-EVT-03** | 存储模式切换 | `engine/event_store.rs` (扩展) | 支持配置全量/增量模式，默认全量，可通过配置开启增量 | 3 | 可选 |

**后端开发小计**: 125 人时（不含可选 15 人时）

---

### 2.2 前端开发（50 人时）

#### 2.2.1 文件系统与展示模块（10 人时）

**文件结构**: `src/components/FileTree/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-FS-01** | .elf/ 目录置顶展示 | `FileTree.tsx` | 修改文件树渲染逻辑，将 `.elf/` 目录置顶，添加特殊图标和样式区分 | 3 | Step 1 |
| **F-FS-02** | SKILLS.md 编辑器 | `SkillsEditor.tsx` (新建) | 创建 SKILLS.md 专用编辑器，支持命令格式高亮、参数提示、预览 | 4 | F1 |
| **F-FS-03** | 项目级配置面板 | `ProjectConfigPanel.tsx` (新建) | 在 `.elf/projects/{name}/` 下显示配置面板，编辑项目级 SKILLS.md 和 CLAUDE.md | 3 | Step 2 |

#### 2.2.2 Agent 模块（18 人时）

**文件结构**: `src/components/Agent/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-AGENT-01** | Claude Session 选择器 | `SessionSelector.tsx` (新建) | 调用 `scan_claude_sessions`，显示活跃 sessions 列表（session_id、project、最后活跃时间），支持搜索和选择 | 5 | F10 |
| **F-AGENT-02** | Agent 关联流程 UI | `AgentLinkWizard.tsx` (新建) | 多步骤向导：1. 选择 session 2. 配置 Agent 名称 3. 预览合并后的 SKILLS 4. 确认关联 | 6 | F10 |
| **F-AGENT-03** | Agent Block 配置面板 | `AgentConfigPanel.tsx` (修改) | 显示 Agent 关联的 session_id、editor_id、SKILLS 路径、symlink 状态，支持解除关联 | 4 | F10 |
| **F-AGENT-04** | Symlink 状态指示器 | `SymlinkStatus.tsx` (新建) | 显示 Claude skills symlink 状态（已链接/未链接/冲突），支持手动修复 | 3 | F2 |

#### 2.2.3 Session 同步模块（10 人时）

**文件结构**: `src/components/Session/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-SYNC-01** | Session Log 查看器 | `SessionLogViewer.tsx` (新建) | 显示 `session/log-xxx.md` 内容，按时间线展示对话记录，高亮 tool_use 调用 | 4 | F4-F5 |
| **F-SYNC-02** | 同步状态指示器 | `SyncStatus.tsx` (新建) | 显示会话同步状态（syncing/idle/error），最后同步时间，手动同步按钮 | 3 | F4 |
| **F-SYNC-03** | Session-Task 关联展示 | `TaskSessionRelation.tsx` (新建) | 在 task.md 中显示关联的 session logs，点击跳转到对应位置 | 3 | F6 |

#### 2.2.4 Git 模块（12 人时）

**文件结构**: `src/components/Git/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 对应用户故事 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-GIT-01** | 一键导出+提交面板 | `ExportCommitPanel.tsx` (新建) | 显示待导出的 Blocks、从 task.md 解析的分支名和 commit message，支持编辑和执行 | 5 | F7 |
| **F-GIT-02** | Hooks 配置面板 | `HooksConfigPanel.tsx` (新建) | 编辑 `.elf/git/hooks/` 下的 hook 脚本，显示 core.hooksPath 状态 | 3 | F8 |
| **F-GIT-03** | 归档文档查看器 | `ArchiveViewer.tsx` (新建) | 渲染归档 summary markdown，支持时间线视图、关联资源跳转 | 4 | F9 |

**前端开发小计**: 50 人时

---

### 2.3 测试与集成（20 人时）

**文件结构**: `src-tauri/src/*/tests.rs` + `src/__tests__/`

| 编号 | 任务名称 | 文件位置 | 详细内容 | 预估人时 | 覆盖范围 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T-UNIT-01** | CLI 模块单元测试 | `cli/tests.rs` | 测试命令行解析、IPC 通信 Mock、直接操作模式 | 3 | F3 |
| **T-UNIT-02** | Agent 模块单元测试 | `extensions/agent/tests.rs` | 测试 session 扫描、Agent 关联、SKILLS 合并逻辑 | 3 | F10 |
| **T-UNIT-03** | Session 同步单元测试 | `sync/tests.rs` | 测试 JSONL 解析、增量解析、时序保证 | 3 | F4-F5 |
| **T-UNIT-04** | Git 模块单元测试 | `git/tests.rs` | 测试 Hooks 复制、Task 解析、Merge 检测 | 3 | F7-F9 |
| **T-INT-01** | CLI 端到端测试 | `tests/integration/cli_e2e.rs` | 完整流程：CLI 命令 → Engine 执行 → Event 记录 → 状态更新 | 4 | F1-F3 |
| **T-INT-02** | Session 同步集成测试 | `tests/integration/session_sync.rs` | 完整流程：JSONL 变化 → 解析 → Session Log 创建 → Relation 建立 | 4 | F4-F6 |

**测试小计**: 20 人时

---

**研发总计**: 195 人时（后端 125 + 前端 50 + 测试 20）

---

## 三、产品任务规划（55 人时）

### 3.1 Dogfooding 实验设计（25 人时）

| 编号 | 任务名称 | 预估人时 | 对应研究主题 | 详细内容 |
| :--- | :--- | :--- | :--- | :--- |
| **P-DOG-01** | Dogfooding 场景设计 | 8 | R1 | 设计 2-3 个真实开发场景（如：添加新 Capability、修复 Bug、重构模块），定义输入/输出/验收标准 |
| **P-DOG-02** | 环境准备与配置 | 5 | R1 | 准备 Dogfooding 环境：创建测试 .elf 项目、配置 Claude Code、准备测试数据 |
| **P-DOG-03** | Dogfooding 执行 - 场景 1 | 6 | R1 | 执行第一个 Dogfooding 场景，记录操作过程、遇到的问题、改进建议 |
| **P-DOG-04** | Dogfooding 执行 - 场景 2 | 6 | R1 | 执行第二个 Dogfooding 场景，对比改进效果 |

### 3.2 评价指标定义（15 人时）

| 编号 | 任务名称 | 预估人时 | 对应研究主题 | 详细内容 |
| :--- | :--- | :--- | :--- | :--- |
| **P-METRIC-01** | 效率指标定义 | 5 | R2 | 定义效率相关指标：CLI 调用成功率、会话同步延迟、导出+提交耗时 |
| **P-METRIC-02** | 完整性指标定义 | 5 | R2 | 定义完整性指标：Event 覆盖率、会话-代码关联准确率、归档文档质量 |
| **P-METRIC-03** | 数据采集方案 | 5 | R2 | 设计数据采集方案：日志格式、采集点、存储方式、分析脚本 |

### 3.3 归因分析（15 人时）

| 编号 | 任务名称 | 预估人时 | 对应研究主题 | 详细内容 |
| :--- | :--- | :--- | :--- | :--- |
| **P-ATTR-01** | 分析框架设计 | 5 | R3 | 设计归因分析框架：哪些环节提效、哪些是瓶颈、如何量化改进空间 |
| **P-ATTR-02** | Dogfooding 数据分析 | 6 | R3 | 分析 Dogfooding 执行数据，识别关键问题和改进点 |
| **P-ATTR-03** | 归因报告输出 | 4 | R3 | 输出归因分析报告，包含问题清单、优先级排序、Phase 3 建议 |

**产品总计**: 55 人时

---

## 四、里程碑与依赖

### 4.1 开发节奏与里程碑

**总体节奏**: 基础设施 → CLI + Agent → Session 同步 → Git 集成 → Dogfooding → 优化

**里程碑划分**:

| 里程碑 | 时间节点 | 开发内容 | 验收标准 | 对应任务 |
| :--- | :--- | :--- | :--- | :--- |
| **M1: 基础设施就绪** | Week 1 Day 1-2 | 1. .elf 目录结构初始化<br>2. 通用 SKILLS.md 模板<br>3. 置顶展示 | ✓ 新建 .elf 自动生成 `.elf/` 目录<br>✓ 通用 SKILLS.md 包含基础命令<br>✓ .elf/ 目录在 UI 中置顶 | B-FS-01~03<br>F-FS-01 |
| **M2: CLI 可用** | Week 1 Day 3-5 | 4. CLI 入口和 IPC<br>5. Skills 生成器<br>6. Symlink 管理 | ✓ `elfiee --agent {id} core.create` 可执行<br>✓ SKILLS.md 可自动生成<br>✓ Symlink 正确创建/删除 | B-CLI-01~06<br>B-FS-04~05 |
| **M3: Agent 关联** | Week 2 Day 1-2 | 7. Claude Session 扫描<br>8. Agent 关联流程<br>9. SKILLS 合并 | ✓ 可扫描活跃的 Claude sessions<br>✓ 关联后自动创建 Agent Block<br>✓ Agent SKILLS 正确合并 | B-AGENT-01~06<br>F-AGENT-01~04 |
| **M4: elfiee-ext-gen 改造** | Week 2 Day 3 | 10. ext-gen 协议层改造<br>11. 导出集成 | ✓ ext-gen 通过 CLI 生成代码<br>✓ 生成后自动导出到物理文件 | B-CLI-07~08 |
| **M5: Session 同步** | Week 2 Day 4-5 | 12. JSONL 监听和解析<br>13. Session Log 写入<br>14. 时序保证 | ✓ Claude 会话自动同步到 Elfiee<br>✓ Session Log 正确创建<br>✓ 时序正确（会话 Event 在前） | B-SYNC-01~07<br>F-SYNC-01~03 |
| **M6: Git 集成** | Week 3 Day 1-2 | 15. Hooks 管理<br>16. 一键导出+提交<br>17. Merge 检测和归档 | ✓ Hooks 正确复制和切换<br>✓ task.md 驱动 Git 操作<br>✓ Merge 后自动生成归档 | B-GIT-01~07<br>F-GIT-01~03 |
| **M7: Dogfooding** | Week 3 Day 3-4 | 产品执行 Dogfooding<br>研发修复问题 | ✓ 完成 2 个 Dogfooding 场景<br>✓ P0 Bug 修复<br>✓ 收集改进建议 | P-DOG-03~04<br>T-INT-01~02 |
| **M8: 优化与收尾** | Week 3 Day 5 | 18. Bug 修复<br>19. 归因分析报告 | ✓ P0/P1 Bug 修复<br>✓ 归因报告输出<br>✓ Phase 3 建议整理 | P-ATTR-02~03 |

---

### 4.2 产研协作时间线

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         Phase 2 产研协作时间线（3 周）                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Week 1（基础开发周）                                                        │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 1-2: M1 基础设施就绪           │                                      │
│  │   研发：.elf 目录 + SKILLS 模板     │                                      │
│  │   产品：Dogfooding 场景设计         │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 3-5: M2 CLI 可用               │                                      │
│  │   研发：CLI + Skills + Symlink     │                                      │
│  │   产品：评价指标定义                │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  Week 2（核心功能周）                                                        │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 1-2: M3 Agent 关联             │                                      │
│  │   研发：Session 扫描 + Agent 关联   │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 3: M4 elfiee-ext-gen 改造      │                                      │
│  │   研发：协议层 + 导出集成           │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 4-5: M5 Session 同步           │                                      │
│  │   研发：JSONL 解析 + 时序保证       │                                      │
│  │   产品：Dogfooding 环境准备         │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  Week 3（集成与验证周）                                                       │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 1-2: M6 Git 集成               │                                      │
│  │   研发：Hooks + 导出提交 + 归档     │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 3-4: M7 Dogfooding             │                                      │
│  │   产品：执行 2 个场景              │                                      │
│  │   研发：修复 P0 Bug                │                                      │
│  └──────────────────────────────────┘                                      │
│           │                                                                │
│           v                                                                │
│  ┌──────────────────────────────────┐                                      │
│  │ Day 5: M8 优化与收尾               │                                      │
│  │   研发：Bug 修复                   │                                      │
│  │   产品：归因报告输出               │                                      │
│  └──────────────────────────────────┘                                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 关键依赖关系

| 依赖关系 | 说明 | 影响范围 |
| :--- | :--- | :--- |
| **M1 → M2** | CLI 依赖 .elf 目录结构和 SKILLS 模板 | Week 1 Day 3 |
| **M2 → M3** | Agent 关联依赖 CLI 和 Symlink 能力 | Week 2 Day 1 |
| **M2 → M4** | elfiee-ext-gen 改造依赖 CLI 可用 | Week 2 Day 3 |
| **M3 → M5** | Session 同步依赖 Agent 关联（需要 editor_id） | Week 2 Day 4 |
| **M5 → M6** | Git 归档依赖 Session 同步（汇总 Events） | Week 3 Day 1 |
| **M6 → M7** | Dogfooding 依赖全部核心功能就绪 | Week 3 Day 3 |

**风险依赖**:
- **M2 CLI IPC** 是关键节点，IPC 通信失败会影响后续所有功能
- **M5 Session 同步** 涉及文件监听，可能有性能和稳定性问题
- **M4 elfiee-ext-gen** 是独立模块，可并行开发，降低关键路径风险

---

## 五、风险预留与缓冲

### 5.1 Phase 2 风险评估

**开发侧风险**：
1. **CLI IPC 通信（中风险）**：跨平台 IPC（Unix Socket vs Named Pipe）复杂度，预计可能延期 1-2 天
2. **Session 同步稳定性（高风险）**：文件监听、增量解析、时序保证，复杂度高
3. **elfiee-ext-gen 改造（低风险）**：独立模块，风险可控

**产品侧风险**：
1. **Dogfooding 发现核心问题**：可能需要调整架构或工作流
2. **Claude Code 版本变化**：session 文件格式可能变化

### 5.2 风险预留策略

**总预算**: 280 人时
**风险预留**: 30 人时（约 10% 缓冲）

| 风险类型 | 预留时间 | 应对策略 |
| :--- | :--- | :--- |
| **CLI IPC 调试** | 8 人时 | 优先实现直接操作模式，IPC 延后 |
| **Session 同步稳定性** | 10 人时 | 降级为手动同步，自动监听推迟 |
| **Dogfooding 问题修复** | 8 人时 | 优先修复 P0，P1/P2 推迟到 Phase 3 |
| **其他意外** | 4 人时 | 灵活调配 |

**降级策略**：
- **CLI IPC 失败**：降级为直接操作模式（CLI 直接打开 .elf 文件）
- **Session 同步不稳定**：降级为手动触发同步（"Sync Now" 按钮）
- **Git Merge 检测失败**：降级为手动触发归档

---

## 六、产研协作流程

### 6.1 协作时间线

```
┌────────────────────────────────────────────────────────────────────┐
│                      二阶段产研协作流程                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Week 1                                                            │
│  ┌──────────────────────┐    ┌─────────────────────┐              │
│  │ 产品：Dogfooding 设计 │    │ 研发：基础设施 + CLI  │              │
│  └──────────────────────┘    └─────────────────────┘              │
│           │                           │                            │
│           v                           v                            │
│  Week 2                                                            │
│  ┌──────────────────────┐    ┌─────────────────────┐              │
│  │ 产品：指标定义        │    │ 研发：Agent + Session │              │
│  │      环境准备         │    │      + ext-gen       │              │
│  └──────────────────────┘    └─────────────────────┘              │
│           │                           │                            │
│           v                           v                            │
│  Week 3                                                            │
│  ┌──────────────────────┐    ┌─────────────────────┐              │
│  │ 产品：执行 Dogfooding │<──│ 研发：Git 集成        │              │
│  │      归因分析         │    │      Bug 修复        │              │
│  └──────────────────────┘    └─────────────────────┘              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 关键协作机制

| 机制 | 描述 |
| :--- | :--- |
| **里程碑验收** | 每个里程碑完成后，产品+研发联合验收 |
| **问题清单制** | Dogfooding 过程中维护「问题清单」，研发按优先级处理 |
| **日同步** | Week 3 Dogfooding 期间，产研每日同步进展 |

### 6.3 产研协作的输入输出

| 阶段 | 产品输入 | 研发输入 | 产品输出 | 研发输出 |
| :--- | :--- | :--- | :--- | :--- |
| **Week 1** | target-and-story_v2.md | 技术规范 | Dogfooding 场景设计 | M1-M2 完成 |
| **Week 2** | Dogfooding 场景 | M1-M2 成果 | 指标体系 + 环境准备 | M3-M5 完成 |
| **Week 3** | M3-M6 成果 | 问题清单 | 归因报告 + Phase 3 建议 | M6-M8 完成 + Bug 修复 |
