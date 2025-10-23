# 扩展开发指南

本指南解释了如何为 Elfiee 系统创建自定义的区块类型 (`Block Type`) 和能力 (`Capability`)。

## 目录

1. [概览](#概览)
2. [创建一个新扩展](#创建一个新扩展)
3. [定义能力](#定义能力)
4. [注册你的扩展](#注册你的扩展)
5. [测试你的扩展](#测试你的扩展)
6. [授权与 CBAC](#授权与-cbac)
7. [最佳实践](#最佳实践)
8. [完整示例：Markdown 扩展](#完整示例markdown-扩展)

## 概览

Elfiee 使用基于能力 (`Capability-based`) 的架构，其中：
- **`Block` (区块)** 是基本的数据单元（如文档、笔记、任务）。
- **`Capability` (能力)** 是可以对 `Block` 执行的操作。
- **`Extension` (扩展)** 为自定义的 `Block` 类型提供特定领域的能力。

系统使用事件溯源 (`Event Sourcing`) 和 EAVT (Entity-Attribute-Value-Timestamp) 模式，所有变更都记录为不可变的事件。

## 创建一个新扩展

### 步骤 1: 创建扩展目录结构

在 `src/extensions/` 目录下为你的扩展创建一个新目录：

```bash
mkdir -p src/extensions/my_extension
```

你的扩展应包含：
- `mod.rs` - 模块定义和文档。
- 单独的能力文件 (例如, `my_capability.rs`)。

### 步骤 2: 定义你的扩展模块

创建 `src/extensions/my_extension/mod.rs`：

```rust
/// 我的 Elfiee 扩展。
///
/// 描述你的扩展的功能。
///
/// ## 能力
///
/// - `my_extension.capability1`: 描述
/// - `my_extension.capability2`: 描述

pub mod my_capability;

// 重新导出能力以便注册
pub use my_capability::*

#[cfg(test)]
mod tests {
    // 在这里编写你的测试
}
```

## 定义能力

### 基本能力结构

使用 `#[capability]` 宏来定义一个能力处理器：

```rust
use crate::capabilities::core::{CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

/// my_extension.do_something 能力的处理器。
///
/// 详细描述这个能力的作用。
#[capability(id = "my_extension.do_something", target = "my_block_type")]
fn handle_do_something(cmd: &Command, block: &Block) -> CapResult<Vec<Event>> {
    // 1. 从 cmd.payload 中提取参数
    let param = cmd.payload.get("param")
        .and_then(|v| v.as_str())
        .ok_or("Payload 中缺少 'param'")?;

    // 2. 执行验证
    if param.is_empty() {
        return Err("参数不能为空".into());
    }

    // 3. 计算新状态
    let mut new_contents = if let Some(obj) = block.contents.as_object() {
        obj.clone()
    } else {
        serde_json::Map::new()
    };
    new_contents.insert("my_field".to_string(), serde_json::json!(param));

    // 4. 创建事件
    let event = create_event(
        block.block_id.clone(),        // 实体 (通常是 block_id)
        "my_extension.do_something",   // 能力 ID
        serde_json::json!({ "contents": new_contents }),  // 新状态
        &cmd.editor_id,                // 执行者
        1,                             // TODO: 使用实际的向量时钟
    );

    // 5. 返回一个或多个事件
    Ok(vec![event])
}
```

### `#[capability]` 宏参数

- `id`: 唯一的能力标识符 (格式: `extension_name.capability_name`)。
- `target`: 该能力适用的 `Block` 类型 (使用 `"*"` 表示适用于所有类型)。

### 事件创建指南

`create_event` 辅助函数会自动将事件的 `attribute` 格式化为 `{editor_id}/{cap_id}`：

```rust
let event = create_event(
    entity,        // String - 事件关联的实体 (通常是 block_id)
    cap_id,        // &str - 能力 ID
    value,         // serde_json::Value - 新的状态或数据
    editor_id,     // &str - 执行者
    editor_count,  // u64 - 向量时钟计数 (TODO: 待正确实现)
);
```

### 读与写能力

**写能力** (修改区块状态):
```rust
// 实体是被修改的区块
let event = create_event(
    block.block_id.clone(),
    "my_extension.write",
    serde_json::json!({ "contents": new_contents }),
    &cmd.editor_id,
    1,
);
```

**读能力** (观察而不修改):
```rust
// 实体是读取者 (cmd.editor_id)
let event = create_event(
    cmd.editor_id.clone(),     // 注意：实体是读取者
    "my_extension.read",
    serde_json::json!({
        "block_id": block.block_id,
        "data": extracted_data
    }),
    &cmd.editor_id,
    1,
);
```

## 注册你的扩展

### 步骤 1: 将扩展添加到 `src/extensions/mod.rs`

```rust
pub mod markdown;
pub mod my_extension;  // 添加你的扩展
```

### 步骤 2: 在注册表中注册能力

编辑 `src/capabilities/registry.rs` 以包含你的扩展：

```rust
/// 注册所有扩展能力。
fn register_extensions(&mut self) {
    use crate::extensions::markdown::*
    use crate::extensions::my_extension::*;  // 添加此行

    // 已有的注册
    self.register(Arc::new(MarkdownWriteCapability));
    self.register(Arc::new(MarkdownReadCapability));

    // 注册你的能力
    self.register(Arc::new(MyCapability1));
    self.register(Arc::new(MyCapability2));
}
```

### 步骤 3: 更新 `src/lib.rs` (如果需要)

`extensions` 模块应该已经在 `lib.rs` 中被导出了：

```rust
pub mod extensions;
```

## 测试你的扩展

### 单元测试

在你的扩展的 `mod.rs` 文件中添加测试：

```rust
#[cfg(test)]
mod tests {
    use crate::capabilities::CapabilityRegistry;
    use crate::models::{Block, Command};

    #[test]
    fn test_my_capability_basic() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("my_extension.do_something")
            .expect("能力应该已被注册");

        let block = Block::new(
            "Test Block".to_string(),
            "my_block_type".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "my_extension.do_something".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "param": "test_value" }),
        );

        let events = cap.handler(&cmd, &block).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].attribute, "alice/my_extension.do_something");

        // 验证事件是否包含预期数据
        let value = &events[0].value;
        // 在此添加你的断言
    }

    #[test]
    fn test_my_capability_validation() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("my_extension.do_something").unwrap();

        let block = Block::new(
            "Test Block".to_string(),
            "my_block_type".to_string(),
            "alice".to_string(),
        );

        // 使用无效输入进行测试
        let cmd = Command::new(
            "alice".to_string(),
            "my_extension.do_something".to_string(),
            block.block_id.clone(),
            serde_json::json!({}),  // 缺少必需的参数
        );

        let result = cap.handler(&cmd, &block);
        assert!(result.is_err());
    }
}
```

### 运行测试

```bash
cargo test
```

## 授权与 CBAC

Elfiee 使用基于能力的访问控制 (`Capability-Based Access Control`, CBAC) 和一个 `GrantsTable`：

### 授权模型

1.  **所有者永远被授权**: 区块的所有者可以对他们的区块执行任何能力。
2.  **基于授权的访问**: 非所有者需要显式的授权。
3.  **通配符授权**: `"*"` 作为 `block_id` 会授予对所有区块的权限。

### 实现授权检查

虽然能力处理器不直接检查授权（关注点分离），但你应该测试授权逻辑：

```rust
#[test]
fn test_authorization_owner() {
    use crate::capabilities::grants::GrantsTable;

    let grants_table = GrantsTable::new();
    let block = Block::new(
        "Test".to_string(),
        "my_type".to_string(),
        "alice".to_string(),
    );

    let cmd = Command::new(
        "alice".to_string(),
        "my_extension.do_something".to_string(),
        block.block_id.clone(),
        serde_json::json!({}),
    );

    // 检查授权
    let is_authorized = block.owner == cmd.editor_id
        || grants_table.has_grant(
            &cmd.editor_id,
            "my_extension.do_something",
            &block.block_id
        );

    assert!(is_authorized, "所有者应该被授权");
}

#[test]
fn test_authorization_non_owner_with_grant() {
    use crate::capabilities::grants::GrantsTable;

    let mut grants_table = GrantsTable::new();
    let block = Block::new(
        "Test".to_string(),
        "my_type".to_string(),
        "alice".to_string(),
    );

    // 授予 bob 权限
    grants_table.add_grant(
        "bob".to_string(),
        "my_extension.do_something".to_string(),
        block.block_id.clone(),
    );

    let cmd = Command::new(
        "bob".to_string(),
        "my_extension.do_something".to_string(),
        block.block_id.clone(),
        serde_json::json!({}),
    );

    let is_authorized = block.owner == cmd.editor_id
        || grants_table.has_grant(
            &cmd.editor_id,
            "my_extension.do_something",
            &block.block_id
        );

    assert!(is_authorized, "拥有授权的用户应该被允许");
}
```

### 授权管理

授权是通过 `core.grant` 和 `core.revoke` 能力来管理的：

```rust
// 授予用户一项能力
let grant_cmd = Command::new(
    "alice".to_string(),  // 授权者 (必须是所有者)
    "core.grant".to_string(),
    block.block_id.clone(),
    serde_json::json!({
        "target_editor": "bob",
        "capability": "my_extension.do_something",
        "target_block": block.block_id,  // 或 "*" 表示通配符
    }),
);

// 从用户处撤销一项能力
let revoke_cmd = Command::new(
    "alice".to_string(),
    "core.revoke".to_string(),
    block.block_id.clone(),
    serde_json::json!({
        "target_editor": "bob",
        "capability": "my_extension.do_something",
        "target_block": block.block_id,
    }),
);
```

## 最佳实践

### 1. 命名约定

- 扩展名: 小写加下划线 (`my_extension`)。
- 能力 ID: `extension_name.capability_name`。
- 能力结构体名: 帕斯卡命名法（PascalCase）并以 `Capability` 结尾。

### 2. 错误处理

返回描述性的错误信息：

```rust
// 好
return Err("Payload 中缺少 'content'".into());

// 不好
return Err("错误".into());
```

### 3. 保留已有状态

更新区块内容时，保留你未修改的字段：

```rust
let mut new_contents = if let Some(obj) = block.contents.as_object() {
    obj.clone()  // 从现有内容开始
} else {
    serde_json::Map::new()
};
new_contents.insert("my_field".to_string(), serde_json::json!(new_value));
// 其他字段被保留
```

### 4. 文档

- 记录每个能力的作用。
- 解释所需的 `payload` 字段。
- 描述所创建的事件结构。
- 提供用法示例。

### 5. 测试

为以下场景编写测试：
- 基本功能
- 输入验证
- 错误情况
- 授权场景
- 状态保留

## 完整示例：Markdown 扩展

Markdown 扩展是一个完整的参考实现。其结构如下：

```
src/extensions/markdown/
├── mod.rs              # 模块定义和测试
├── markdown_write.rs   # 写入 markdown 内容
└── markdown_read.rs    # 读取 markdown 内容
```

### markdown_write.rs

```rust
use crate::capabilities::core::{CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

#[capability(id = "markdown.write", target = "markdown")]
fn handle_markdown_write(cmd: &Command, block: &Block) -> CapResult<Vec<Event>> {
    let markdown_content = cmd.payload.get("content")
        .and_then(|v| v.as_str())
        .ok_or("Payload 中缺少 'content'")?;

    let mut new_contents = if let Some(obj) = block.contents.as_object() {
        obj.clone()
    } else {
        serde_json::Map::new()
    };
    new_contents.insert("markdown".to_string(), serde_json::json!(markdown_content));

    let event = create_event(
        block.block_id.clone(),
        "markdown.write",
        serde_json::json!({ "contents": new_contents }),
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
```

### markdown_read.rs

```rust
use crate::capabilities::core::{CapResult, create_event};
use crate::models::{Block, Command, Event};
use capability_macros::capability;

#[capability(id = "markdown.read", target = "markdown")]
fn handle_markdown_read(cmd: &Command, block: &Block) -> CapResult<Vec<Event>> {
    let markdown_content = block.contents.get("markdown")
        .ok_or("在区块中未找到 markdown 内容")?;

    let event = create_event(
        cmd.editor_id.clone(),  // 对于读操作，实体是读取者
        "markdown.read",
        serde_json::json!({
            "block_id": block.block_id,
            "content": markdown_content
        }),
        &cmd.editor_id,
        1,
    );

    Ok(vec![event])
}
```

### 用法示例

```rust
use elfiee::models::{Block, Command};
use elfiee::capabilities::CapabilityRegistry;

// 创建一个 markdown 区块
let mut block = Block::new(
    "My Document".to_string(),
    "markdown".to_string(),
    "alice".to_string(),
);

let registry = CapabilityRegistry::new();

// 写入 markdown
let write_cmd = Command::new(
    "alice".to_string(),
    "markdown.write".to_string(),
    block.block_id.clone(),
    serde_json::json!({
        "content": "# Hello World\n\nThis is markdown."
    }),
);

let cap = registry.get("markdown.write").unwrap();
let events = cap.handler(&write_cmd, &block).unwrap();

// 应用事件以更新区块状态 (在真实系统中)
// block.apply_events(&events);

// 读取 markdown
let read_cmd = Command::new(
    "alice".to_string(),
    "markdown.read".to_string(),
    block.block_id.clone(),
    serde_json::json!({}),
);

let cap = registry.get("markdown.read").unwrap();
let read_events = cap.handler(&read_cmd, &block).unwrap();
```

## 后续步骤

1.  研究 `src/extensions/markdown/` 中的 Markdown 扩展实现。
2.  回顾 `src/capabilities/builtins/` 中的核心能力。
3.  遵循本指南创建你自己的扩展。
4.  添加全面的测试。
5.  考虑将你的扩展贡献回项目。

更多信息，请参阅：
- [README.md](../../README.md) - 项目概览和架构
- [Part 4: Extension Interface](../plans/part4-extension-interface.md) - 技术规范
- [Part 7: Content Schema Proposal](../plans/part7-content-schema-proposal.md) - 未来的模式设计
- [Capability Macros](../../src-tauri/capability-macros/) - 宏实现细节
