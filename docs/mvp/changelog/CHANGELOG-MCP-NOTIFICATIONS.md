# Changelog: MCP Notifications（状态变更推送）

> **日期**: 2026-01-30
> **版本**: MVP 增强版
> **影响范围**: Engine Actor、MCP Server、AppState、Transport 层

---

## 概述

实现 MCP Notifications 机制，当 Engine 状态变更（block 创建/更新/删除、权限变更等）时，
通过 MCP 标准的 `notifications/resources/updated` 消息推送给已连接的 MCP 客户端。
这使得 AI Agent 能够实时感知 GUI 或其他编辑者的变更。

### 架构

```
Engine Actor (process_command)
    │ commit 后（步骤 11）
    ▼
broadcast::Sender<StateChangeEvent>    ← tokio broadcast channel（AppState 持有）
    │
    └──► Dispatcher task ──► PeerRegistry ──► peer.notify_resource_updated(uri)
                                 │
                                 ├── SSE 模式：多 peer 共享 registry
                                 └── stdio 模式：单 peer
```

---

## 1. StateChangeEvent 广播

### 新增文件

**`src-tauri/src/mcp/notifications.rs`**

定义引擎提交事件后广播的数据类型：

```rust
pub struct StateChangeEvent {
    pub file_id: String,
    pub events: Vec<Event>,  // 已持久化的事件（不含 _block_dir）
}
```

### 修改: AppState

**`src-tauri/src/state.rs`**

新增 `state_change_tx` 字段，应用启动时初始化 broadcast channel（容量 256）：

```rust
pub struct AppState {
    // ... 原有字段
    pub state_change_tx: broadcast::Sender<StateChangeEvent>,
}
```

---

## 2. Engine Actor 广播集成

### 修改: ElfileEngineActor

**`src-tauri/src/engine/actor.rs`**

- 新增 `state_change_tx: Option<broadcast::Sender<StateChangeEvent>>` 字段
- `process_command()` 在步骤 10（write_snapshots）之后新增步骤 11：广播已持久化事件
- 广播使用 `events_to_persist`（已清除 `_block_dir` 的干净事件）

```rust
// 步骤 11: 广播状态变更通知
if let Some(ref tx) = self.state_change_tx {
    let _ = tx.send(StateChangeEvent {
        file_id: self.file_id.clone(),
        events: events_to_persist,
    });
}
```

### 修改: spawn_engine 签名

**`src-tauri/src/engine/actor.rs`** + **`src-tauri/src/engine/manager.rs`**

```rust
// 旧签名
pub async fn spawn_engine(file_id, event_pool_with_path) -> Result<EngineHandle, String>

// 新签名
pub async fn spawn_engine(file_id, event_pool_with_path, state_change_tx: Option<...>) -> ...
```

`EngineManager::spawn_engine` 同步更新，透传 `state_change_tx`。

### 调用方更新

| 文件 | 传入值 |
|---|---|
| `commands/file.rs` (create_file, open_file) | `Some(state.state_change_tx.clone())` |
| `engine/standalone.rs` (create_standalone_engine) | `Some(app_state.state_change_tx.clone())` |
| 所有测试代码（actor, manager, integration） | `None` |

---

## 3. PeerRegistry（Peer 注册表）

### 新增文件

**`src-tauri/src/mcp/peer_registry.rs`**

线程安全的 MCP 客户端注册表，追踪每个 peer 的 URI 订阅：

```rust
pub struct PeerRegistry {
    peers: Arc<DashMap<String, PeerEntry>>,  // peer_id -> { peer, subscribed_uris }
    next_id: Arc<AtomicU64>,
}
```

核心方法：

| 方法 | 说明 |
|---|---|
| `register(peer_id, peer)` | `on_initialized` 时注册 peer |
| `unregister(peer_id)` | 断开连接时移除 |
| `subscribe(peer_id, uri)` | 追踪 URI 订阅 |
| `unsubscribe(peer_id, uri)` | 移除 URI 订阅 |
| `get_subscribers(uri)` | 获取订阅了指定 URI 的所有 peer |
| `get_all_peers()` | 获取所有连接中的 peer |

自动清理：`get_subscribers` 和 `get_all_peers` 会检测并移除 transport 已关闭的 stale peer。

---

## 4. Notification Dispatcher（通知分发器）

### 新增文件

**`src-tauri/src/mcp/dispatcher.rs`**

后台任务，桥接 broadcast channel 到 MCP peer 通知：

```rust
pub async fn run_notification_dispatcher(
    rx: broadcast::Receiver<StateChangeEvent>,
    registry: PeerRegistry,
    app_state: Arc<AppState>,
)
```

### URI 映射规则

根据事件的 capability ID 推导受影响的资源 URI：

| Capability | 受影响 URI |
|---|---|
| `core.create`, `core.delete` | `elfiee://{project}/blocks` + `elfiee://{project}/block/{id}` |
| `markdown.write`, `code.write`, `core.link`, `core.unlink`, `core.rename` 等 | `elfiee://{project}/block/{id}` |
| `core.grant`, `core.revoke` | `elfiee://{project}/grants` |
| 任何事件 | `elfiee://{project}/events`（总是包含） |

---

## 5. MCP Server 协议支持

### 修改: ElfieeMcpServer

**`src-tauri/src/mcp/server.rs`**

- 新增 `peer_registry: PeerRegistry` 和 `peer_id: String` 字段
- 构造函数更新：`new(app_state, peer_registry)`
- `get_info()` 声明订阅能力：

```rust
resources: Some(ResourcesCapability {
    subscribe: Some(true),
    list_changed: Some(true),
}),
```

- 实现 `on_initialized`：注册 peer 到 registry
- 实现 `subscribe`：记录 peer 的 URI 订阅
- 实现 `unsubscribe`：移除 peer 的 URI 订阅

---

## 6. Transport 层接线

### SSE 模式

**`src-tauri/src/mcp/transport.rs`**

```rust
pub async fn start_mcp_server(app_state, port) {
    let registry = PeerRegistry::new();
    // 启动 dispatcher 后台任务
    tokio::spawn(run_notification_dispatcher(rx, registry.clone(), app_state.clone()));
    // 每个 SSE 连接共享同一个 registry
    sse_server.with_service(|| ElfieeMcpServer::new(app_state.clone(), registry.clone()));
}
```

### stdio 模式

**`src-tauri/src/mcp/stdio_transport.rs`**

- `start_stdio_server` 签名新增 `app_state: Arc<AppState>` 参数
- 内部启动 dispatcher 后台任务

**`src-tauri/src/mcp/standalone.rs`**

- 创建 `PeerRegistry`，传入 `ElfieeMcpServer`
- 将 `app_state` 传入 `start_stdio_server`

---

## 7. 模块导出

### 修改: `src-tauri/src/mcp/mod.rs`

新增三个模块导出：

```rust
pub mod dispatcher;
pub mod notifications;
pub mod peer_registry;
```

---

## 变更文件总览

### 新增（4 个文件）

| 文件 | 说明 |
|---|---|
| `src/mcp/notifications.rs` | StateChangeEvent 类型定义 |
| `src/mcp/peer_registry.rs` | Peer 注册表 + URI 订阅追踪 |
| `src/mcp/dispatcher.rs` | 广播 → MCP 通知分发器 |
| `tests/mcp_notifications_integration.rs` | 6 个集成测试 |

### 修改（13 个文件）

| 文件 | 变更 |
|---|---|
| `src/state.rs` | 新增 `state_change_tx` 字段 |
| `src/engine/actor.rs` | 新增广播字段、步骤 11、签名变更 |
| `src/engine/manager.rs` | 签名变更 + 测试更新 |
| `src/mcp/mod.rs` | 新增 3 个 module 导出 |
| `src/mcp/server.rs` | PeerRegistry 集成、subscribe/unsubscribe |
| `src/mcp/transport.rs` | 创建 registry + 启动 dispatcher |
| `src/mcp/stdio_transport.rs` | 签名变更 + 启动 dispatcher |
| `src/mcp/standalone.rs` | 创建 registry、传入 app_state |
| `src/engine/standalone.rs` | 传入 state_change_tx |
| `src/commands/file.rs` | 传入 state_change_tx |
| `src/commands/checkout.rs` | 测试: 传入 None |
| `src/commands/editor.rs` | 测试: 传入 None |
| `tests/` (6 个集成测试文件) | spawn_engine 调用加 None 参数 |

---

## 测试

### 自动化测试

```bash
# 运行通知相关集成测试（6 个）
cargo test --test mcp_notifications_integration

# 运行全部测试（276 + 67 = 343 个）
cargo test
```

### 新增测试用例

| 测试 | 验证内容 |
|---|---|
| `test_broadcast_on_create_block` | core.create 触发广播 |
| `test_broadcast_on_markdown_write` | markdown.write 触发广播 |
| `test_broadcast_events_stripped_of_block_dir` | 广播事件不含 _block_dir |
| `test_broadcast_multiple_commands` | 每个命令独立广播 |
| `test_no_broadcast_without_sender` | tx=None 时引擎正常工作 |
| `test_broadcast_grant_event` | core.grant 触发广播 |

### 手动测试

**stdio 模式**:
```bash
cargo run -- mcp-server --elf path/to/test.elf
# MCP 客户端发送 subscribe 后，执行 tool 操作可收到 notifications/resources/updated
```

**SSE 模式**:
1. `pnpm tauri dev` 启动 GUI
2. MCP 客户端连接 `http://127.0.0.1:47200/sse`
3. 发送 `resources/subscribe` 订阅 URI
4. GUI 修改 → 客户端收到通知
