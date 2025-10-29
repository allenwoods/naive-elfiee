# Extension 开发快速指南

## 目录

1. [Extension 概念](#extension-概念)
2. [开发准备](#开发准备)
3. [开发步骤](#开发步骤)
4. [完整示例：Todo Extension](#完整示例todo-extension)
5. [测试策略](#测试策略)
6. [常见模式](#常见模式)
7. [故障排查](#故障排查)

---

## Extension 概念

### 什么是 Extension？

**Extension（扩展）** 是 Elfiee 的插件系统，用于为特定类型的 Block 添加功能。

**核心组成**：
```
Extension = Payload定义 + Capability集合 + 测试套件
```

**类比理解**：
```
Extension 类似于 RESTful API 的资源模块
Capability 类似于单个 API 端点
Payload 类似于请求体的 Schema
```

### Extension 与 Capability 的关系

```
extensions/todo/              ← Extension (模块级)
├── mod.rs                    ← Payload 定义 + 模块导出
├── todo_add.rs               ← Capability (操作级)
├── todo_toggle.rs            ← Capability
└── todo_remove.rs            ← Capability
```

| 概念 | 职责 | 示例 |
|------|------|------|
| **Extension** | 为某类 Block 提供完整功能集 | `todo` (任务管理) |
| **Capability** | 实现一个具体操作 | `todo.add_item` (添加任务) |
| **Payload** | 定义操作的输入参数 | `TodoAddPayload { text: String }` |

### 架构流程

```
前端发起 Command
    ↓
ElfileEngineActor 接收
    ↓
CapabilityRegistry.get(cap_id)  ← Extension 在此注册
    ↓
certificator() - CBAC 授权检查
    ↓
handler() - 执行 Extension 逻辑
    ↓
返回 Event[] → 持久化到 events.db
    ↓
StateProjector 投影更新状态
    ↓
前端接收更新
```

---

## 开发准备

### 环境要求

- Rust 1.70+
- 熟悉 Rust 基础（struct, trait, macro）
- 了解 Event Sourcing 概念
- 了解 Capability-Based Access Control (CBAC)

### 核心依赖

Extension 开发会用到以下 crate：

```toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
specta = { version = "=2.0.0-rc.22" }  # TypeScript 类型生成
capability-macros = { path = "capability-macros" }  # 过程宏
```

### 关键模块

```rust
use crate::capabilities::core::{CapabilityHandler, CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use serde::{Deserialize, Serialize};
use specta::Type;
```

---

## 开发步骤

### 步骤 1：规划 Extension 设计

**问题清单**：

1. **目标 Block 类型是什么？**
   - 示例：`todo`、`markdown`、`diagram`

2. **需要哪些 Capabilities？**
   - 创建（create/add）
   - 读取（read/list）
   - 更新（update/toggle）
   - 删除（remove/delete）

3. **Block.contents 结构是什么？**
   ```json
   {
     "field1": "value",
     "field2": { ... }
   }
   ```

4. **权限模型是什么？**
   - Owner 默认有所有权限
   - 哪些 Capability 可以授予其他用户？

**设计文档模板**：

```markdown
## Todo Extension 设计

### Block Type
- `block_type`: "todo"

### Capabilities
- `todo.add_item` - 添加待办项
- `todo.toggle_item` - 切换完成状态
- `todo.remove_item` - 删除待办项
- `todo.list_items` - 列出所有项

### Contents Schema
```json
{
  "items": [
    {
      "id": "uuid",
      "text": "任务内容",
      "completed": false,
      "created_at": 1234567890
    }
  ]
}
```

### Authorization
- Owner 可以执行所有操作
- `todo.add_item` 和 `todo.toggle_item` 可授予协作者
- `todo.remove_item` 仅限 Owner
```

### 步骤 2：创建目录结构

```bash
cd src-tauri/src/extensions
mkdir -p todo
cd todo
touch mod.rs todo_add.rs todo_toggle.rs todo_remove.rs todo_list.rs
```

**目录结构**：
```
extensions/todo/
├── mod.rs              # Payload 定义 + 模块导出 + 测试
├── todo_add.rs         # todo.add_item 实现
├── todo_toggle.rs      # todo.toggle_item 实现
├── todo_remove.rs      # todo.remove_item 实现
└── todo_list.rs        # todo.list_items 实现
```

### 步骤 3：定义 Payload 类型（`mod.rs`）

**关键规则**：
- ✅ **必须** 使用 `#[derive(Serialize, Deserialize, Type)]`
- ✅ `Type` trait 用于生成 TypeScript 类型
- ✅ 所有字段必须有文档注释
- ❌ **不要** 使用嵌套的匿名结构（前端难以使用）

```rust
// src/extensions/todo/mod.rs
use serde::{Deserialize, Serialize};
use specta::Type;

/// Payload for todo.add_item capability
///
/// Adds a new item to the todo list.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TodoAddPayload {
    /// The task text (non-empty)
    pub text: String,
}

/// Payload for todo.toggle_item capability
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TodoTogglePayload {
    /// The item ID to toggle
    pub item_id: String,
}

/// Payload for todo.remove_item capability
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TodoRemovePayload {
    /// The item ID to remove
    pub item_id: String,
}

/// Todo item data structure
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TodoItem {
    pub id: String,
    pub text: String,
    pub completed: bool,
    pub created_at: i64,
}

// 导出 capability 模块
pub mod todo_add;
pub mod todo_toggle;
pub mod todo_remove;
pub mod todo_list;

// 重新导出（供 registry 注册）
pub use todo_add::*;
pub use todo_toggle::*;
pub use todo_remove::*;
pub use todo_list::*;

#[cfg(test)]
mod tests {
    // 测试代码（步骤 6）
}
```

### 步骤 4：实现 Capability Handler

**使用 `#[capability]` 宏**：

```rust
// src/extensions/todo/todo_add.rs
use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, Event};
use capability_macros::capability;
use super::{TodoAddPayload, TodoItem};
use uuid::Uuid;
use chrono::Utc;

/// Handler for todo.add_item capability
///
/// Adds a new item to the todo list in block.contents.items
#[capability(id = "todo.add_item", target = "todo")]
fn handle_todo_add(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required for todo.add_item")?;

    // 1. 反序列化 Payload
    let payload: TodoAddPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for todo.add_item: {}", e))?;

    // 2. 验证输入
    if payload.text.trim().is_empty() {
        return Err("Task text cannot be empty".to_string());
    }

    // 3. 获取现有 items
    let mut items: Vec<TodoItem> = if let Some(items_value) = block.contents.get("items") {
        serde_json::from_value(items_value.clone())
            .map_err(|e| format!("Invalid items structure: {}", e))?
    } else {
        vec![]
    };

    // 4. 创建新 item
    let new_item = TodoItem {
        id: Uuid::new_v4().to_string(),
        text: payload.text,
        completed: false,
        created_at: Utc::now().timestamp(),
    };
    items.push(new_item);

    // 5. 更新 contents（保留其他字段）
    let mut new_contents = block.contents.as_object()
        .cloned()
        .unwrap_or_else(|| serde_json::Map::new());
    new_contents.insert("items".to_string(), serde_json::to_value(&items).unwrap());

    // 6. 创建 Event
    let event = create_event(
        block.block_id.clone(),
        "todo.add_item",
        serde_json::json!({ "contents": new_contents }),
        &cmd.editor_id,
        1,  // Placeholder - Actor 会更新为正确的向量时钟
    );

    Ok(vec![event])
}
```

**Capability Handler 模式**：

```rust
#[capability(id = "extension.capability", target = "block_type")]
fn handle_capability(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // 1. 验证输入（block 是否存在）
    let block = block.ok_or("Block required")?;

    // 2. 反序列化 Payload
    let payload: MyPayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload: {}", e))?;

    // 3. 业务逻辑验证
    if !validate(&payload) {
        return Err("Validation failed".to_string());
    }

    // 4. 计算新状态
    let new_state = compute_new_state(block, &payload)?;

    // 5. 创建 Event
    let event = create_event(
        block.block_id.clone(),
        "extension.capability",
        serde_json::json!({ "contents": new_state }),
        &cmd.editor_id,
        1,
    );

    // 6. 返回 Event 数组
    Ok(vec![event])
}
```

### 步骤 5：注册 Extension

#### 5.1 导出 Extension 模块

```rust
// src-tauri/src/extensions/mod.rs
pub mod markdown;
pub mod todo;  // 添加这行
```

#### 5.2 注册到 CapabilityRegistry

```rust
// src-tauri/src/capabilities/registry.rs
fn register_extensions(&mut self) {
    use crate::extensions::markdown::*;
    use crate::extensions::todo::*;  // 添加

    // Markdown
    self.register(Arc::new(MarkdownWriteCapability));
    self.register(Arc::new(MarkdownReadCapability));

    // Todo (添加这些)
    self.register(Arc::new(TodoAddItemCapability));
    self.register(Arc::new(TodoToggleItemCapability));
    self.register(Arc::new(TodoRemoveItemCapability));
    self.register(Arc::new(TodoListItemsCapability));
}
```

**注意**：Capability struct 名由宏自动生成：
- `"todo.add_item"` → `TodoAddItemCapability`
- `"markdown.write"` → `MarkdownWriteCapability`

#### 5.3 注册 Payload 类型到 Specta

```rust
// src-tauri/src/lib.rs (在 debug_assertions 块中)
let specta_builder = tauri_specta::Builder::<tauri::Wry>::new()
    .commands(...)
    // 已有的类型
    .typ::<extensions::markdown::MarkdownWritePayload>()
    // 添加 Todo 类型
    .typ::<extensions::todo::TodoAddPayload>()
    .typ::<extensions::todo::TodoTogglePayload>()
    .typ::<extensions::todo::TodoRemovePayload>()
    .typ::<extensions::todo::TodoItem>();
```

### 步骤 6：编写测试

**测试分类**：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::capabilities::CapabilityRegistry;
    use crate::capabilities::grants::GrantsTable;
    use crate::models::{Block, Command};

    // ============================================
    // 功能测试 - 验证核心逻辑
    // ============================================

    #[test]
    fn test_add_item_basic() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("todo.add_item").unwrap();

        let block = Block::new(
            "My Tasks".to_string(),
            "todo".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "todo.add_item".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "text": "Buy milk" }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].entity, block.block_id);
        assert_eq!(events[0].attribute, "alice/todo.add_item");

        // 验证内容
        let contents = events[0].value.get("contents").unwrap();
        let items: Vec<TodoItem> = serde_json::from_value(
            contents.get("items").unwrap().clone()
        ).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].text, "Buy milk");
        assert!(!items[0].completed);
    }

    // ============================================
    // 验证测试 - 输入校验
    // ============================================

    #[test]
    fn test_add_item_empty_text_fails() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("todo.add_item").unwrap();

        let block = Block::new(
            "My Tasks".to_string(),
            "todo".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "todo.add_item".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "text": "   " }),  // 空白
        );

        let result = cap.handler(&cmd, Some(&block));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("cannot be empty"));
    }

    #[test]
    fn test_add_item_missing_text_fails() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("todo.add_item").unwrap();

        let block = Block::new(
            "My Tasks".to_string(),
            "todo".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "todo.add_item".to_string(),
            block.block_id.clone(),
            serde_json::json!({}),  // 缺少 text 字段
        );

        let result = cap.handler(&cmd, Some(&block));
        assert!(result.is_err());
    }

    // ============================================
    // 状态保留测试 - 确保不破坏现有数据
    // ============================================

    #[test]
    fn test_add_item_preserves_existing_items() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("todo.add_item").unwrap();

        // Block 已有一个 item
        let mut block = Block::new(
            "My Tasks".to_string(),
            "todo".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({
            "items": [
                {
                    "id": "existing-id",
                    "text": "Existing task",
                    "completed": false,
                    "created_at": 1234567890
                }
            ]
        });

        let cmd = Command::new(
            "alice".to_string(),
            "todo.add_item".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "text": "New task" }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();

        let contents = events[0].value.get("contents").unwrap();
        let items: Vec<TodoItem> = serde_json::from_value(
            contents.get("items").unwrap().clone()
        ).unwrap();

        assert_eq!(items.len(), 2);  // 两个 item
        assert_eq!(items[0].text, "Existing task");
        assert_eq!(items[1].text, "New task");
    }

    // ============================================
    // 授权测试 - CBAC 验证
    // ============================================

    #[test]
    fn test_authorization_owner() {
        let grants_table = GrantsTable::new();

        let block = Block::new(
            "My Tasks".to_string(),
            "todo".to_string(),
            "alice".to_string(),
        );

        // Owner 应该被授权
        let is_authorized = block.owner == "alice"
            || grants_table.has_grant("alice", "todo.add_item", &block.block_id);

        assert!(is_authorized);
    }

    #[test]
    fn test_authorization_non_owner_without_grant() {
        let grants_table = GrantsTable::new();

        let block = Block::new(
            "My Tasks".to_string(),
            "todo".to_string(),
            "alice".to_string(),
        );

        // Bob 没有 grant，不应被授权
        let is_authorized = block.owner == "bob"
            || grants_table.has_grant("bob", "todo.add_item", &block.block_id);

        assert!(!is_authorized);
    }

    #[test]
    fn test_authorization_non_owner_with_grant() {
        let mut grants_table = GrantsTable::new();

        let block = Block::new(
            "My Tasks".to_string(),
            "todo".to_string(),
            "alice".to_string(),
        );

        // 授予 Bob 权限
        grants_table.add_grant(
            "bob".to_string(),
            "todo.add_item".to_string(),
            block.block_id.clone(),
        );

        let is_authorized = block.owner == "bob"
            || grants_table.has_grant("bob", "todo.add_item", &block.block_id);

        assert!(is_authorized);
    }

    // ============================================
    // 集成测试 - 完整工作流
    // ============================================

    #[test]
    fn test_full_workflow_add_toggle_remove() {
        let registry = CapabilityRegistry::new();

        let mut block = Block::new(
            "My Tasks".to_string(),
            "todo".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({ "items": [] });

        // 1. 添加 item
        let add_cap = registry.get("todo.add_item").unwrap();
        let cmd = Command::new(
            "alice".to_string(),
            "todo.add_item".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "text": "Buy milk" }),
        );
        let events = add_cap.handler(&cmd, Some(&block)).unwrap();

        // 更新 block 状态（模拟 StateProjector）
        block.contents = events[0].value.get("contents").unwrap().clone();

        // 提取 item_id
        let items: Vec<TodoItem> = serde_json::from_value(
            block.contents.get("items").unwrap().clone()
        ).unwrap();
        let item_id = items[0].id.clone();

        // 2. Toggle item
        let toggle_cap = registry.get("todo.toggle_item").unwrap();
        let cmd = Command::new(
            "alice".to_string(),
            "todo.toggle_item".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "item_id": item_id }),
        );
        let events = toggle_cap.handler(&cmd, Some(&block)).unwrap();

        block.contents = events[0].value.get("contents").unwrap().clone();

        // 验证 toggle
        let items: Vec<TodoItem> = serde_json::from_value(
            block.contents.get("items").unwrap().clone()
        ).unwrap();
        assert!(items[0].completed);

        // 3. Remove item
        let remove_cap = registry.get("todo.remove_item").unwrap();
        let cmd = Command::new(
            "alice".to_string(),
            "todo.remove_item".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "item_id": item_id }),
        );
        let events = remove_cap.handler(&cmd, Some(&block)).unwrap();

        block.contents = events[0].value.get("contents").unwrap().clone();

        // 验证删除
        let items: Vec<TodoItem> = serde_json::from_value(
            block.contents.get("items").unwrap().clone()
        ).unwrap();
        assert_eq!(items.len(), 0);
    }
}
```

### 步骤 7：运行测试

```bash
cd src-tauri
cargo test todo::tests
```

**预期输出**：
```
running 9 tests
test todo::tests::test_add_item_basic ... ok
test todo::tests::test_add_item_empty_text_fails ... ok
test todo::tests::test_add_item_missing_text_fails ... ok
test todo::tests::test_add_item_preserves_existing_items ... ok
test todo::tests::test_authorization_owner ... ok
test todo::tests::test_authorization_non_owner_without_grant ... ok
test todo::tests::test_authorization_non_owner_with_grant ... ok
test todo::tests::test_full_workflow_add_toggle_remove ... ok

test result: ok. 9 passed; 0 failed
```

### 步骤 8：验证 TypeScript 类型生成

```bash
pnpm tauri dev
# 或
cd src-tauri && cargo build
```

**检查生成的类型**：

```bash
cat ../src/bindings.ts | grep -A 5 "TodoAddPayload"
```

**预期输出**：
```typescript
export type TodoAddPayload = {
  /** The task text (non-empty) */
  text: string
}

export type TodoItem = {
  id: string
  text: string
  completed: boolean
  created_at: number
}
```

### 步骤 9：前端使用

```typescript
// src/components/TodoBlock.tsx
import { commands } from '../bindings'
import type { TodoAddPayload, TodoItem } from '../bindings'

async function addTodoItem(blockId: string, text: string) {
    const payload: TodoAddPayload = { text }  // 类型检查！

    const result = await commands.executeCommand({
        editorId: 'alice',
        capId: 'todo.add_item',
        blockId: blockId,
        payload: payload
    })

    if (result.status === 'ok') {
        console.log('Item added successfully')
    } else {
        console.error('Failed to add item:', result.error)
    }
}
```

---

## 完整示例：Todo Extension

已在上述步骤中展示，包含：
- ✅ 4 个 Capabilities
- ✅ 9 个测试用例
- ✅ TypeScript 类型生成
- ✅ 完整的 CRUD 功能

---

## 测试策略

### 测试金字塔

```
        /\
       /集成\       1 个 - test_full_workflow
      /------\
     / 授权测试 \    3 个 - owner/grant/no_grant
    /----------\
   /  验证测试   \   2 个 - empty/missing
  /--------------\
 /    功能测试     \  3 个 - basic/preserve/edge_cases
/------------------\
```

### 测试覆盖率目标

- **功能测试**：覆盖所有正常路径
- **验证测试**：覆盖所有错误路径
- **授权测试**：覆盖 CBAC 场景
- **集成测试**：覆盖多 Capability 交互

**最低要求**：每个 Capability 至少 3 个测试
- 1 个基本功能测试
- 1 个错误处理测试
- 1 个授权测试

---

## 常见模式

### 模式 1：写操作（修改 Block 状态）

```rust
#[capability(id = "ext.write", target = "my_type")]
fn handle_write(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required")?;

    // 计算新状态
    let new_contents = compute_new_contents(block, &cmd.payload)?;

    // Entity 是 block_id
    let event = create_event(
        block.block_id.clone(),
        "ext.write",
        serde_json::json!({ "contents": new_contents }),
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
```

### 模式 2：读操作（不修改状态）

```rust
#[capability(id = "ext.read", target = "my_type")]
fn handle_read(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required")?;

    let data = extract_data(block)?;

    // Entity 是 reader (cmd.editor_id)
    let event = create_event(
        cmd.editor_id.clone(),  // 注意：不是 block_id
        "ext.read",
        serde_json::json!({
            "block_id": block.block_id,
            "data": data
        }),
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
```

### 模式 3：状态保留

```rust
// ✅ 正确：保留现有字段
let mut new_contents = block.contents.as_object()
    .cloned()
    .unwrap_or_else(|| serde_json::Map::new());
new_contents.insert("my_field".to_string(), serde_json::json!(new_value));

// ❌ 错误：覆盖所有内容
let new_contents = serde_json::json!({ "my_field": new_value });
```

### 模式 4：复杂验证

```rust
fn validate_payload(payload: &MyPayload) -> CapResult<()> {
    if payload.text.trim().is_empty() {
        return Err("Text cannot be empty".to_string());
    }

    if payload.priority > 10 {
        return Err("Priority must be <= 10".to_string());
    }

    Ok(())
}

#[capability(id = "ext.create", target = "my_type")]
fn handle_create(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let payload: MyPayload = serde_json::from_value(cmd.payload.clone())?;

    validate_payload(&payload)?;  // 分离验证逻辑

    // ... 继续处理
}
```

---

## 故障排查

### 问题 1：TypeScript 类型未生成

**症状**：`bindings.ts` 中找不到你的 Payload 类型

**解决**：
1. 确认 Payload 有 `#[derive(Type)]`
2. 在 `src-tauri/src/lib.rs` 中注册：
   ```rust
   .typ::<extensions::my_ext::MyPayload>()
   ```
3. 重新编译：`cd src-tauri && cargo build`

### 问题 2：Capability 未注册

**症状**：运行时错误 `Unknown capability: my_ext.do_something`

**解决**：
1. 检查 `extensions/mod.rs` 是否导出了你的模块
2. 检查 `registry.rs` 中是否注册了 Capability
3. 确认 struct 名正确（由 cap_id 推导）

### 问题 3：测试失败 - Payload 反序列化

**症状**：`Invalid payload: missing field 'xxx'`

**解决**：
1. 检查测试中的 JSON 是否包含所有必填字段
2. 使用 `Option<T>` 表示可选字段
3. 查看错误信息确认缺少哪个字段

### 问题 4：授权测试失败

**症状**：`Authorization failed`

**解决**：
1. 确认测试中 `cmd.editor_id` 是否是 block owner
2. 如果不是，确认是否添加了 grant
3. 检查 grant 的 cap_id 和 block_id 是否正确

### 问题 5：前端类型错误

**症状**：TypeScript 报错 `Property 'xxx' does not exist`

**解决**：
1. 确认 `bindings.ts` 已更新（重新运行 `pnpm tauri dev`）
2. 检查拼写是否正确（Rust 的 `snake_case` 会转为 TS 的 `camelCase`）
3. 确认导入路径正确

---

## 开发检查清单

### Phase 1: 设计
- [ ] 定义 Extension 名称和目标 block_type
- [ ] 列出所有 Capabilities
- [ ] 设计 Block.contents Schema
- [ ] 规划权限模型

### Phase 2: 实现
- [ ] 创建目录结构
- [ ] 定义 Payload 类型（含 `#[derive(Type)]`）
- [ ] 实现所有 Capability handlers
- [ ] 导出模块（`mod.rs`）
- [ ] 注册到 CapabilityRegistry
- [ ] 注册 Payload 到 Specta

### Phase 3: 测试
- [ ] 每个 Capability 至少 3 个测试
- [ ] 功能测试通过
- [ ] 验证测试通过
- [ ] 授权测试通过
- [ ] 集成测试通过
- [ ] 运行 `cargo test` 全部通过

### Phase 4: 集成
- [ ] 编译生成 TypeScript 类型
- [ ] 验证 `bindings.ts` 包含所有类型
- [ ] 前端可以正确导入和使用
- [ ] 端到端测试通过

### Phase 5: 文档
- [ ] 添加 Capability 文档注释
- [ ] 添加 Payload 字段注释
- [ ] 更新 README（如果需要）
- [ ] 添加使用示例

---

## 下一步

1. **实践**：按照本指南实现一个简单的 Extension
2. **参考**：查看 `src/extensions/markdown` 的完整实现
3. **工具**：使用 `elfiee-ext-gen` 生成器加速开发
4. **文档**：阅读 `docs/guides/EXTENSION_DEVELOPMENT.md` 了解更多细节

**相关文档**：
- [Generator 工作设计](./generator-work-design.md)
- [Generator 开发计划](./generator-dev-plan.md)
- [核心架构文档](../../docs/concepts/ARCHITECTURE_OVERVIEW.md)
