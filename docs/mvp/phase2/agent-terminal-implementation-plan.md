# Phase 2.2: Agent 核心实现计划

**创建日期**: 2026-01-10
**状态**: 规划中
**阶段**: Phase 2.2 - Agent 核心
**前置条件**: Phase 2.1 (Terminal 基础设施) 完成
**目标**: 实现 Bot Agent 配置管理，并支持 Agent 在 Terminal 中执行代码

> **注意**: 本文档专注于 Agent 功能实现。Terminal 基础设施（UI 集成、外部环境打通）请参考 `phase2.1-terminal-infrastructure.md`。

---

## 一、背景与目标

### 1.1 需求背景

根据 Phase 2 的设计方案（`agent&terminal-design-v2.md`），我们需要实现：

1. **Agent Block Extension**：支持创建 Bot 类型的 Editor，并通过 Block 存储其配置
2. **配置文件管理**：支持从外部配置文件（`~/.elfiee/agents/*.json`）加载和保存 Agent 配置
3. **Terminal 集成**：Agent 能够在关联的 Terminal Block 中执行命令
4. **权限控制**：基于现有 CBAC 体系，Agent 需要显式授权才能使用 Terminal

### 1.2 MVP 范围

**Phase 1-3（Week 1-2）**：
- ✅ Agent Block 基础设施（数据结构、Capabilities）
- ✅ 配置文件加载/保存
- ✅ Agent-Terminal 关联与命令执行
- ✅ 基础前端 UI（Agent Block 组件、命令输入）

**Phase 4（Future）**：
- ⏸️ AI LLM API 集成（Anthropic/OpenAI）
- ⏸️ Proposal 机制（AI 建议 → 用户审批 → 执行）

---

## 二、架构设计

### 2.1 核心概念

```
┌─────────────┐      reference      ┌──────────────┐
│ Agent Block │ ─────────────────→  │Terminal Block│
│  (ai_agent) │                     │  (terminal)  │
└─────────────┘                     └──────────────┘
      ↓                                      ↓
   Editor ID                          Permission Check
   (agent-xxx)                        (terminal.write)
```

**关键原则**：
1. **Agent 是配置 + 身份**：Agent Block 存储配置，关联一个独立的 Bot Editor
2. **权限遵循 CBAC**：Agent 需要通过 `core.grant` 获得 `terminal.write` 权限
3. **Event Sourcing**：所有操作（配置更新、命令执行）记录为 Events

### 2.2 数据结构设计

#### A. Agent Block Contents

```rust
// src-tauri/src/extensions/agent/config.rs

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AgentConfig {
    /// 关联的 Bot Editor ID（创建时自动生成: "agent-{uuid}"）
    pub editor_id: String,

    /// Agent 显示名称
    pub display_name: String,

    /// AI 提供商配置
    pub provider: AgentProvider,

    /// 系统提示词（可选）
    pub system_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum AgentProvider {
    Anthropic {
        model: String,           // "claude-sonnet-4-5"
        api_key_env: String,     // "ANTHROPIC_API_KEY"
    },
    OpenAI {
        model: String,
        api_key_env: String,
    },
    /// For Phase 1: No actual LLM integration
    Mock,
}
```

#### B. 配置文件格式

```json
// ~/.elfiee/agents/{agent_id}.json

{
  "name": "CodeAssistant",
  "provider": {
    "type": "anthropic",
    "model": "claude-sonnet-4-5",
    "api_key_env": "ANTHROPIC_API_KEY"
  },
  "system_prompt": "You are a helpful coding assistant working in the Elfiee environment.",
  "metadata": {
    "created_at": "2026-01-10T10:00:00Z",
    "updated_at": "2026-01-10T10:00:00Z"
  }
}
```

#### C. Block Relation 结构

```javascript
// Agent Block
{
  "block_id": "agent-abc123",
  "block_type": "ai_agent",
  "contents": { /* AgentConfig */ },
  "children": {
    "reference": [
      "terminal-xyz789",   // 关联的 Terminal Block
      "directory-def456"   // 关联的 Directory Block（可选）
    ]
  },
  "owner": "alice"
}

// Terminal Block
{
  "block_id": "terminal-xyz789",
  "block_type": "terminal",
  "contents": {
    "shell": "bash",
    "env": {},
    "linked_directory_id": "directory-def456"  // 外部模式
  },
  "owner": "alice"
}
```

---

## 三、开发任务清单

### Phase 1: Agent Block Extension 基础设施

**估时**: 2-3 天

#### 任务 1.1: 创建 Agent Extension 目录结构

```bash
src-tauri/src/extensions/agent/
├── mod.rs              # Extension 入口
├── config.rs           # AgentConfig 数据结构
├── config_loader.rs    # 配置文件加载器
└── capabilities.rs     # Capability handlers
```

**文件清单**：
- [ ] `mod.rs`: 导出所有公共模块
- [ ] `config.rs`: 定义 `AgentConfig` 和 `AgentProvider`
- [ ] `config_loader.rs`: 实现配置文件读写逻辑
- [ ] `capabilities.rs`: 实现 `ai_agent.*` capabilities

#### 任务 1.2: 实现 `ai_agent.create` Capability

**功能**：
- 自动创建 Bot Editor（`editor_id = "agent-{uuid}"`）
- 初始化 Agent Block 配置
- 生成对应的 Events

**Payload**：
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AgentCreatePayload {
    pub name: String,
    pub display_name: String,
    pub provider: AgentProvider,
    pub system_prompt: Option<String>,
}
```

**Handler 逻辑**：
```rust
#[capability(id = "ai_agent.create", target = "ai_agent")]
pub async fn handle_create(
    cmd: Command,
    state: Arc<StateProjector>,
) -> Result<Vec<Event>, String> {
    let payload: AgentCreatePayload = serde_json::from_value(cmd.payload)?;

    // 1. 生成 Agent Editor ID
    let agent_editor_id = format!("agent-{}", uuid::Uuid::new_v4());

    // 2. 创建配置
    let config = AgentConfig {
        editor_id: agent_editor_id.clone(),
        display_name: payload.display_name,
        provider: payload.provider,
        system_prompt: payload.system_prompt,
    };

    // 3. 生成 Events
    let events = vec![
        // Event 1: 创建 Bot Editor
        Event {
            entity: agent_editor_id.clone(),
            attribute: format!("{}/core.create", cmd.editor_id),
            value: serde_json::json!({
                "editor_id": agent_editor_id,
                "name": payload.name,
                "editor_type": "Bot",
            }),
            ...
        },
        // Event 2: 写入 Agent Block contents
        Event {
            entity: cmd.target_id.clone(),
            attribute: format!("{}/ai_agent.create", cmd.editor_id),
            value: serde_json::to_value(config)?,
            ...
        }
    ];

    Ok(events)
}
```

**测试用例**：
- [ ] 创建 Agent 成功，生成正确的 Editor ID
- [ ] 配置正确写入 Block contents
- [ ] 权限检查：仅 owner 可创建

#### 任务 1.3: 实现 `ai_agent.update_config` Capability

**功能**：更新 Agent 配置（模型、提示词等）

**Payload**：
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AgentUpdateConfigPayload {
    pub display_name: Option<String>,
    pub provider: Option<AgentProvider>,
    pub system_prompt: Option<String>,
}
```

**测试用例**：
- [ ] 更新配置成功
- [ ] 权限检查：仅 owner 可更新
- [ ] 保持 `editor_id` 不变

---

### Phase 2: 配置文件管理

**估时**: 1 天

#### 任务 2.1: 实现 `AgentConfigLoader`

**功能**：
- 从 `~/.elfiee/agents/{agent_id}.json` 加载配置
- 保存配置到文件
- 列出所有已保存的配置

**实现**：
```rust
// src-tauri/src/extensions/agent/config_loader.rs

use std::fs;
use std::path::PathBuf;

pub struct AgentConfigLoader {
    config_dir: PathBuf,
}

impl AgentConfigLoader {
    pub fn new() -> Result<Self, String> {
        let home = dirs::home_dir().ok_or("Cannot find home directory")?;
        let config_dir = home.join(".elfiee").join("agents");

        // 确保目录存在
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;

        Ok(Self { config_dir })
    }

    pub fn load(&self, agent_id: &str) -> Result<AgentConfig, String> {
        let path = self.config_dir.join(format!("{}.json", agent_id));
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Invalid config JSON: {}", e))
    }

    pub fn save(&self, agent_id: &str, config: &AgentConfig) -> Result<(), String> {
        let path = self.config_dir.join(format!("{}.json", agent_id));
        let json = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&path, json)
            .map_err(|e| format!("Failed to write config: {}", e))
    }

    pub fn list_configs(&self) -> Result<Vec<String>, String> {
        let entries = fs::read_dir(&self.config_dir)
            .map_err(|e| format!("Failed to read config dir: {}", e))?;

        let agent_ids: Vec<String> = entries
            .filter_map(|entry| {
                let path = entry.ok()?.path();
                if path.extension()? == "json" {
                    Some(path.file_stem()?.to_string_lossy().to_string())
                } else {
                    None
                }
            })
            .collect();

        Ok(agent_ids)
    }
}
```

#### 任务 2.2: 添加 Tauri Commands

```rust
// src-tauri/src/commands/agent.rs

#[tauri::command]
#[specta]
pub async fn load_agent_config_from_file(
    agent_id: String,
) -> Result<AgentConfig, String> {
    let loader = AgentConfigLoader::new()?;
    loader.load(&agent_id)
}

#[tauri::command]
#[specta]
pub async fn save_agent_config_to_file(
    agent_id: String,
    config: AgentConfig,
) -> Result<(), String> {
    let loader = AgentConfigLoader::new()?;
    loader.save(&agent_id, &config)
}

#[tauri::command]
#[specta]
pub async fn list_agent_configs() -> Result<Vec<String>, String> {
    let loader = AgentConfigLoader::new()?;
    loader.list_configs()
}
```

**测试用例**：
- [ ] 保存配置成功
- [ ] 加载配置成功
- [ ] 列出所有配置
- [ ] 处理不存在的配置文件

---

### Phase 3: Agent-Terminal 集成

**估时**: 2-3 天

#### 任务 3.1: 实现 `ai_agent.execute_command` Capability

**功能**：Agent 在关联的 Terminal 中执行命令

**Payload**：
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AgentExecuteCommandPayload {
    /// Terminal Block ID
    pub terminal_id: String,

    /// Command to execute
    pub command: String,
}
```

**Handler 逻辑**：
```rust
#[capability(id = "ai_agent.execute_command", target = "ai_agent")]
pub async fn handle_execute_command(
    cmd: Command,
    state: Arc<StateProjector>,
) -> Result<Vec<Event>, String> {
    let payload: AgentExecuteCommandPayload =
        serde_json::from_value(cmd.payload.clone())?;

    // 1. 验证 Agent Block 存在
    let agent_block = state.get_block(&cmd.target_id)
        .ok_or("Agent block not found")?;
    let agent_config: AgentConfig =
        serde_json::from_value(agent_block.contents.clone())?;

    // 2. 验证 Terminal 在 Agent 的 children.reference 中
    let terminal_refs = agent_block.children
        .get("reference")
        .ok_or("Agent has no terminal references")?;

    if !terminal_refs.contains(&payload.terminal_id) {
        return Err("Terminal not in Agent's references".into());
    }

    // 3. 验证 Terminal Block 存在
    let _terminal_block = state.get_block(&payload.terminal_id)
        .ok_or("Terminal block not found")?;

    // 4. 检查权限（Agent 是否有 terminal.write 权限）
    // 这个检查会在实际执行时由 write_to_pty 的 check_terminal_permission 处理

    // 5. 生成 Event 记录命令执行
    let event = Event {
        event_id: uuid::Uuid::new_v4().to_string(),
        entity: payload.terminal_id.clone(),
        attribute: format!("{}/ai_agent.execute_command", agent_config.editor_id),
        value: serde_json::json!({
            "command": payload.command,
            "executed_at": chrono::Utc::now().to_rfc3339(),
        }),
        timestamp: cmd.timestamp.clone(),
    };

    Ok(vec![event])
}
```

#### 任务 3.2: 实现 Tauri Command 层调用

```rust
// src-tauri/src/commands/agent.rs

#[tauri::command]
#[specta]
pub async fn agent_execute_in_terminal(
    app_state: State<'_, AppState>,
    terminal_state: State<'_, TerminalState>,
    file_id: String,
    agent_block_id: String,
    terminal_id: String,
    command: String,
) -> Result<(), String> {
    // 1. 获取 Agent 配置
    let engine = app_state.engine_manager.get_engine(&file_id)
        .ok_or("File not open")?;
    let agent_block = engine.get_block(agent_block_id.clone()).await
        .ok_or("Agent block not found")?;
    let agent_config: AgentConfig = serde_json::from_value(agent_block.contents)?;

    // 2. 构造并执行 ai_agent.execute_command
    let cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        file_id: file_id.clone(),
        editor_id: agent_config.editor_id.clone(),  // Agent 的 editor_id
        target_id: agent_block_id.clone(),
        cap_id: "ai_agent.execute_command".to_string(),
        payload: serde_json::json!({
            "terminal_id": terminal_id.clone(),
            "command": command.clone(),
        }),
        timestamp: VectorClock::new(),
    };

    engine.execute_command(cmd).await?;

    // 3. 实际写入 Terminal PTY
    use crate::extensions::terminal::TerminalWritePayload;
    write_to_pty(
        terminal_state,
        app_state,
        TerminalWritePayload {
            data: format!("{}\n", command),  // 添加换行符自动执行
            block_id: terminal_id,
            file_id,
            editor_id: agent_config.editor_id,
        }
    ).await?;

    Ok(())
}
```

#### 任务 3.3: 实现 Agent-Terminal 关联管理

```rust
#[tauri::command]
#[specta]
pub async fn link_agent_to_terminal(
    app_state: State<'_, AppState>,
    file_id: String,
    editor_id: String,      // 用户的 editor_id（有权限操作 Agent）
    agent_block_id: String,
    terminal_id: String,
) -> Result<(), String> {
    let engine = app_state.engine_manager.get_engine(&file_id)
        .ok_or("File not open")?;

    // 使用 core.link capability
    let cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        file_id,
        editor_id,
        target_id: agent_block_id,
        cap_id: "core.link".to_string(),
        payload: serde_json::json!({
            "target_id": terminal_id,
            "relation_type": "reference",
        }),
        timestamp: VectorClock::new(),
    };

    engine.execute_command(cmd).await
}

#[tauri::command]
#[specta]
pub async fn grant_agent_terminal_permission(
    app_state: State<'_, AppState>,
    file_id: String,
    editor_id: String,      // 用户的 editor_id（Terminal owner）
    agent_editor_id: String, // Agent 的 editor_id
    terminal_id: String,
) -> Result<(), String> {
    let engine = app_state.engine_manager.get_engine(&file_id)
        .ok_or("File not open")?;

    // 使用 core.grant 授予 terminal.write 权限
    let cmd = Command {
        cmd_id: uuid::Uuid::new_v4().to_string(),
        file_id,
        editor_id,
        target_id: terminal_id.clone(),
        cap_id: "core.grant".to_string(),
        payload: serde_json::json!({
            "grantee_id": agent_editor_id,
            "cap_id": "terminal.write",
            "block_id": terminal_id,
        }),
        timestamp: VectorClock::new(),
    };

    engine.execute_command(cmd).await
}
```

**测试用例**：
- [ ] Agent 成功执行命令（有权限）
- [ ] Agent 执行失败（无权限）
- [ ] Agent 执行失败（Terminal 不在 references 中）
- [ ] 关联 Terminal 成功
- [ ] 授权成功，Grant 记录在 EventStore

---

### Phase 4: 前端集成与 UI

**估时**: 2 天

#### 任务 4.1: Agent Block UI 组件

```typescript
// src/components/blocks/AgentBlock.tsx

import { Block } from "@/bindings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface AgentConfig {
  editor_id: string;
  display_name: string;
  provider: {
    type: string;
    model?: string;
    api_key_env?: string;
  };
  system_prompt?: string;
}

export function AgentBlock({ block }: { block: Block }) {
  const config = block.contents as AgentConfig;
  const [command, setCommand] = useState("");

  const linkedTerminals = block.children["reference"] || [];

  const handleExecute = async () => {
    if (!command.trim() || linkedTerminals.length === 0) return;

    // 执行命令（假设使用第一个关联的 Terminal）
    const terminalId = linkedTerminals[0];

    await TauriClient.agentExecuteInTerminal({
      fileId: block.file_id,
      agentBlockId: block.block_id,
      terminalId,
      command,
    });

    setCommand("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{config.display_name}</span>
          <Badge variant="secondary">{config.provider.type}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 显示关联的 Terminals */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Linked Terminals:
          </p>
          {linkedTerminals.length > 0 ? (
            <ul className="text-sm">
              {linkedTerminals.map((id) => (
                <li key={id} className="font-mono">{id}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No terminals linked
            </p>
          )}
        </div>

        {/* 命令输入框 */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleExecute();
            }}
            disabled={linkedTerminals.length === 0}
          />
          <Button
            onClick={handleExecute}
            disabled={!command.trim() || linkedTerminals.length === 0}
          >
            Execute
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 任务 4.2: Agent 配置编辑器

```typescript
// src/components/AgentConfigEditor.tsx

import { useEffect, useState } from "react";
import { AgentConfig } from "@/bindings";
import { TauriClient } from "@/lib/tauri-client";

export function AgentConfigEditor({ agentId }: { agentId: string }) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, [agentId]);

  const loadConfig = async () => {
    try {
      const cfg = await TauriClient.loadAgentConfigFromFile(agentId);
      setConfig(cfg);
    } catch (error) {
      console.error("Failed to load config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      await TauriClient.saveAgentConfigToFile(agentId, config);
      // 显示成功提示
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!config) return <div>Config not found</div>;

  return (
    <div className="space-y-4">
      {/* 编辑表单 */}
      <div>
        <label>Display Name</label>
        <input
          value={config.display_name}
          onChange={(e) =>
            setConfig({ ...config, display_name: e.target.value })
          }
        />
      </div>

      {/* Provider 配置 */}
      <div>
        <label>Provider</label>
        <select
          value={config.provider.type}
          onChange={(e) => {
            // 更新 provider
          }}
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="mock">Mock (No API)</option>
        </select>
      </div>

      {/* System Prompt */}
      <div>
        <label>System Prompt</label>
        <textarea
          value={config.system_prompt || ""}
          onChange={(e) =>
            setConfig({ ...config, system_prompt: e.target.value })
          }
        />
      </div>

      <button onClick={handleSave}>Save Configuration</button>
    </div>
  );
}
```

#### 任务 4.3: Terminal 关联管理 UI

在 Agent Block 组件中添加：

```typescript
// 添加关联 Terminal 的按钮
<Button onClick={handleLinkTerminal}>
  Link Terminal
</Button>

// 授权弹窗
const handleLinkTerminal = async () => {
  // 1. 选择 Terminal Block
  const terminalId = await showTerminalPicker();

  // 2. 关联 Terminal
  await TauriClient.linkAgentToTerminal({
    fileId,
    editorId: currentEditorId,
    agentBlockId: block.block_id,
    terminalId,
  });

  // 3. 授予权限
  await TauriClient.grantAgentTerminalPermission({
    fileId,
    editorId: currentEditorId,
    agentEditorId: config.editor_id,
    terminalId,
  });

  // 4. 刷新 UI
  refreshBlock();
};
```

---

## 四、测试计划

### 4.1 后端测试（Rust）

**单元测试**：
```rust
// src-tauri/src/extensions/agent/tests.rs

#[tokio::test]
async fn test_create_agent_block() {
    // 创建 Agent Block，验证 Editor 生成
}

#[tokio::test]
async fn test_agent_execute_command_with_permission() {
    // Agent 有权限，成功执行
}

#[tokio::test]
async fn test_agent_execute_command_without_permission() {
    // Agent 无权限，执行失败
}

#[tokio::test]
async fn test_config_loader_save_and_load() {
    // 保存并加载配置
}
```

**集成测试**：
```rust
#[tokio::test]
async fn test_agent_terminal_workflow() {
    // 1. 创建 Agent
    // 2. 创建 Terminal
    // 3. 关联 Agent-Terminal
    // 4. 授予权限
    // 5. 执行命令
    // 6. 验证 Event 生成
}
```

### 4.2 前端测试（TypeScript）

```typescript
// src/components/blocks/AgentBlock.test.tsx

describe("AgentBlock", () => {
  it("displays agent config correctly", () => {
    // 渲染 Agent Block，验证显示
  });

  it("executes command when button clicked", async () => {
    // 点击执行按钮，验证调用 Tauri command
  });

  it("disables execute when no terminals linked", () => {
    // 无关联 Terminal 时，禁用按钮
  });
});
```

---

## 五、实现顺序建议

**Week 1**:
1. Day 1-2: Phase 1 任务 1.1-1.3（Agent Extension 基础）
2. Day 3: Phase 2 任务 2.1-2.2（配置文件管理）
3. Day 4-5: Phase 3 任务 3.1-3.3（Terminal 集成）

**Week 2**:
4. Day 1-2: Phase 4 任务 4.1-4.3（前端 UI）
5. Day 3: 集成测试与 Bug 修复
6. Day 4-5: 文档更新与 Demo 演示

---

## 六、注意事项与风险

### 6.1 权限模型复杂度

**问题**：Agent 需要两次授权（link + grant），用户体验较差。

**解决方案**：
- 在前端提供"一键授权"按钮，后台自动执行 link + grant
- 提供权限预检查，显示当前 Agent 的权限状态

### 6.2 配置文件同步

**问题**：配置文件（`~/.elfiee/agents/*.json`）和 Block contents 可能不一致。

**解决方案**：
- Phase 1-3: 配置文件仅用于导入/导出，Block contents 是唯一真相
- Future: 提供"同步配置文件"功能，定期检查一致性

### 6.3 Terminal 输出捕获

**问题**：Agent 执行命令后，如何获取输出？

**解决方案**：
- Phase 1-3: 仅执行命令，不捕获输出（依赖前端 Terminal UI 显示）
- Future: 监听 `pty-out` 事件，实现异步输出捕获

---

## 七、未来扩展方向

### 7.1 AI Proposal 机制（Phase 4）

实现 Agent 调用 LLM API，生成代码建议：

```rust
#[capability(id = "ai_agent.invoke", target = "ai_agent")]
pub async fn handle_invoke(
    cmd: Command,
    state: Arc<StateProjector>,
) -> Result<Vec<Event>, String> {
    // 1. 调用 LLM API
    let response = llm_client.invoke(&prompt).await?;

    // 2. 解析 proposed_commands
    let proposed_commands = parse_llm_response(response)?;

    // 3. 生成 Proposal Event
    let event = Event {
        entity: cmd.target_id,
        attribute: format!("{}/ai_agent.invoke", agent_editor_id),
        value: serde_json::json!({
            "prompt": prompt,
            "proposed_commands": proposed_commands,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }),
        ...
    };

    Ok(vec![event])
}
```

### 7.2 Directory 同步增强

实现 Agent 修改代码后自动导出到外部目录：

```rust
// 监听 Agent 的 code.write 事件
// 自动触发 directory.export
```

### 7.3 多 Agent 协作

实现多个 Agent 共享同一个 Terminal 或 Directory：

```javascript
Agent A (CodeGen) ──┐
                    ├──→ Terminal 1
Agent B (Reviewer)──┘
```

---

**文档作者**: Elfiee Dev Team
**最后更新**: 2026-01-10
