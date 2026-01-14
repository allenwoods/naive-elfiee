# Phase 2 协作功能设计：去中心化准备

**创建日期**: 2026-01-07
**状态**: 讨论完成，待开发

---

## 1. 背景

### 1.1 当前架构状态

Elfiee 已经同时为**中心化本地使用**和**去中心化离线协同**做了基础准备：

| 能力 | 实现状态 | 代码位置 |
|------|---------|---------|
| **CBAC（中心化权限）** | ✅ 已实现 | `capabilities/grants.rs`, `engine/state.rs` |
| **Vector Clock（去中心化基础）** | ✅ 结构已有 | `models/event.rs` → `timestamp: HashMap<String, i64>` |

### 1.2 两种使用场景

| 场景 | 描述 | 当前支持 |
|------|------|---------|
| **中心化本地使用** | 单人单机多角色（Owner + AI Agent），CBAC 控制权限 | ✅ 完整支持 |
| **去中心化离线协同** | 用户 A 编辑后传给用户 B，B 继续编辑，最后合并 | ⚠️ 基础结构就绪，缺合并机制 |

---

## 2. 问题分析

### 2.1 当前设计如何适配两种场景

**中心化场景（Phase 2 主要目标）：**
- Owner 通过 `system_editor_id`（从本地 config 读取）获得最高权限
- AI Agent 通过 `core.grant` 获得受限权限
- CBAC 在本地强制执行，无需修改

**去中心化场景（Phase 6 目标）：**
- 谁在本地打开 `.elf`，谁就是"本地最高权限者"
- 用户 B 打开用户 A 的文件，看到相同界面，使用自己的 editor_id 编辑
- 编辑操作通过 Vector Clock 记录因果关系

### 2.2 核心问题：Editor ID 冲突

当多个用户独立编辑同一个 `.elf` 文件时，可能出现：

```
用户 A 的编辑：{ "alice": 1, "claude-agent": 2 }
用户 B 的编辑：{ "bob": 1, "claude-agent": 3 }  ← claude-agent 冲突！
```

同名的 `editor_id` 会导致 Vector Clock 无法正确识别因果关系。

---

## 3. 解决方案

### 3.1 引入 Node ID

每台设备首次运行 Elfiee 时生成唯一的 `node_id`（UUID），作为设备标识。

**存储位置**: `~/.elfiee/node_id`

### 3.2 扩展向量时钟 Key 格式

将 `timestamp` 的 key 从 `editor_id` 改为 `node_id:editor_id`：

```rust
// 之前
pub timestamp: HashMap<String, i64>  // key = "alice", "claude-agent"

// 之后
pub timestamp: HashMap<String, i64>  // key = "abc123:alice", "abc123:claude-agent"
```

这样即使不同设备有同名的 editor_id，也不会冲突：

```
用户 A（node: abc123）：{ "abc123:alice": 1, "abc123:claude-agent": 2 }
用户 B（node: xyz789）：{ "xyz789:bob": 1, "xyz789:claude-agent": 3 }  ✓ 无冲突
```

### 3.3 CBAC 逻辑不变

本地权限检查只看 `editor_id` 部分：

```rust
fn is_authorized(&self, editor_id: &str, cap_id: &str, block_id: &str) -> bool {
    // 仍然只检查 editor_id，不涉及 node_id
    if block.owner == editor_id { return true; }
    self.grants.has_grant(editor_id, cap_id, block_id)
}
```

---

## 4. 准备工作清单

以下工作在 Phase 2-3 完成，为 Phase 6（离线协作）做准备：

| 任务 | 描述 | 工作量 |
|------|------|--------|
| **引入 Node ID** | 新增 `src-tauri/src/utils/node.rs`，首次启动生成 `~/.elfiee/node_id` | 0.5 天 |
| **向量时钟 Key 扩展** | 修改 Event 生成逻辑，key 格式改为 `node_id:editor_id` | 1 天 |

**总工作量**: ~1.5 天

---

## 5. 具体改动

### 5.1 新增：Node ID 管理

```rust
// src-tauri/src/utils/node.rs
use std::path::PathBuf;
use uuid::Uuid;

/// 获取或创建本机的 Node ID
pub fn get_or_create_node_id() -> String {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("elfiee");
    
    let node_id_path = config_dir.join("node_id");
    
    if node_id_path.exists() {
        std::fs::read_to_string(&node_id_path)
            .unwrap_or_else(|_| create_new_node_id(&node_id_path))
            .trim()
            .to_string()
    } else {
        create_new_node_id(&node_id_path)
    }
}

fn create_new_node_id(path: &PathBuf) -> String {
    let node_id = Uuid::new_v4().to_string();
    let _ = std::fs::create_dir_all(path.parent().unwrap());
    let _ = std::fs::write(path, &node_id);
    node_id
}
```

### 5.2 修改：Event 生成时的 Timestamp

```rust
// 在生成 Event 时，使用 node_id:editor_id 作为 key
fn create_timestamp(node_id: &str, editor_id: &str, count: i64) -> HashMap<String, i64> {
    let mut ts = HashMap::new();
    ts.insert(format!("{}:{}", node_id, editor_id), count);
    ts
}
```

### 5.3 修改：StateProjector 解析 Timestamp

```rust
// 从 timestamp key 中提取 editor_id
fn extract_editor_id(key: &str) -> &str {
    if let Some(pos) = key.find(':') {
        &key[pos + 1..]
    } else {
        key  // 兼容旧格式（如果需要）
    }
}
```

---

## 6. Phase 6 展望

基于以上准备，Phase 6（离线协作）需要实现：

1. **冲突检测**：比较 Vector Clock，识别并发修改
2. **冲突解决 UI**：展示冲突详情，辅助人工解决
3. **合并策略**：Last-Write-Wins 或手动选择
4. **（可选）签名验证**：公钥/私钥机制，验证 Event 来源

这些都依赖于 `node_id:editor_id` 的 key 格式来正确区分不同设备的编辑。

---

## 7. 与整体规划的关系

| 阶段 | 核心内容 | 与本文档的关系 |
|------|---------|---------------|
| Phase 1 ✅ | 协作基础 + Event 记录 | 已完成 |
| **Phase 2-3** | AI 集成 + 逻辑链条 | **本文档准备工作（1.5 天）** |
| Phase 5 | CBAC 权限 + 模板系统 | CBAC 已实现，专注模板 |
| Phase 6 | Vector Clock 离线协作 | 依赖本文档的准备工作 |

---

*讨论记录：2026-01-07*
