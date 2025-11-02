# elfiee-ext-gen

Elfiee 扩展生成器 - 基于测试驱动开发（TDD）的代码生成工具，用于快速创建 Elfiee 项目的扩展（Extensions）。

## 功能特性

- **快速生成扩展骨架**: 自动生成扩展的完整文件结构
- **测试驱动开发**: 生成包含完整测试用例的代码，先写测试，引导实现
- **智能字段推断**: 基于能力名称推断合理的 Payload 字段
- **开箱即用**: 生成的代码可直接编译，测试可直接运行
- **详细开发指南**: 自动生成包含清晰 TODO 标记的开发指南

## 安装

### 使用 cargo install（推荐）

```bash
# 进入工具目录
cd elfiee-ext-gen

# 安装到 ~/.cargo/bin/
cargo install --path .

# 验证安装
elfiee-ext-gen --version
```

安装后，`elfiee-ext-gen` 将可在任意目录使用。

### 开发模式（用于调试模板）

```bash
# 在 elfiee-ext-gen 目录使用 cargo run
cd elfiee-ext-gen
cargo run -- create -n my_ext -b my_type -c action1

# 优点：修改模板后无需重新安装
```

## 使用方法

### 基本用法

```bash
# 在 elfiee 项目的 src-tauri 目录下运行
cd /path/to/elfiee/src-tauri

# 生成扩展（假设已通过 cargo install 安装）
elfiee-ext-gen create \
  -n my_component \
  -b component \
  -c render,update
```

### 命令行参数

```
elfiee-ext-gen create [OPTIONS]

选项:
  -n, --extension-name <NAME>      扩展名称（snake_case）
  -b, --block-type <TYPE>          块类型（例如：markdown, component）
  -c, --capabilities <LIST>        能力列表，逗号分隔（例如：read,write）
      --with-auth-tests            生成授权测试（默认：true）
      --with-workflow-tests        生成工作流测试（默认：true）
  -h, --help                       显示帮助信息
```

### 实际示例

#### 1. 创建简单的扩展

```bash
# 创建一个 markdown 扩展，包含 read 和 write 能力
elfiee-ext-gen create \
  -n markdown \
  -b markdown \
  -c read,write
```

生成的文件结构：
```
src/extensions/markdown/
├── mod.rs                    # 模块定义和 Payload 结构
├── markdown_read.rs          # read 能力处理器
├── markdown_write.rs         # write 能力处理器
├── tests.rs                  # 完整测试套件
└── DEVELOPMENT_GUIDE.md      # 开发指南
```

#### 2. 创建带授权测试的扩展

```bash
# 创建一个组件扩展，包含授权测试
elfiee-ext-gen create \
  -n my_component \
  -b component \
  -c render,update \
  --with-auth-tests
```

#### 3. 创建完整的扩展（包含所有测试）

```bash
# 创建一个功能完整的扩展，包含授权和工作流测试
elfiee-ext-gen create \
  -n data_store \
  -b data \
  -c save,load,query \
  --with-auth-tests \
  --with-workflow-tests
```

## 生成的代码结构

### 模块文件 (mod.rs)

```rust
pub mod my_extension_capability1;
pub use my_extension_capability1::*;

// Payload 定义
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Capability1Payload {
    pub data: serde_json::Value, // 待替换为具体字段
}

#[cfg(test)]
mod tests;
```

### 能力处理器 (capability.rs)

```rust
/// 能力处理器函数，已包含 #[capability] 宏
#[capability(id = "extension.capability", target = "block_type")]
fn handle_capability(
    cmd: &Command,
    block: Option<&Block>
) -> CapResult<Vec<Event>> {
    // TODO: 实现处理逻辑
    todo!("Implement capability handler");
}
```

### 测试文件 (tests.rs)

包含以下测试类型：

**1. Payload 反序列化测试**（每个能力 1 个）
- 验证 JSON 到 Payload 的转换
- 确保字段类型正确

**2. 基本功能测试**（每个能力 1 个）
- 测试能力处理器的核心逻辑
- 验证生成的事件结构
- 检查事件的 entity、attribute、value 字段

**3. 授权测试**（每个能力 3 个，默认生成）
- `test_{capability}_authorization_owner`: 验证块所有者总是被授权
- `test_{capability}_authorization_non_owner_without_grant`: 验证非所有者无授权时被拒绝
- `test_{capability}_authorization_non_owner_with_grant`: 验证非所有者获得授权后可执行
- 完整覆盖 Elfiee 的 CBAC (Capability-Based Access Control) 逻辑

**4. 工作流测试**（整个扩展 1 个，默认生成）
- 测试多个能力的交互场景（如：创建 → 更新 → 查询）
- 验证状态转换的正确性（模拟 StateProjector）
- 模拟真实使用流程的端到端测试

## 开发工作流

### 1. 生成扩展

```bash
cd /path/to/elfiee/src-tauri
/path/to/elfiee-ext-gen create -n my_ext -b my_type -c action1,action2
```

### 2. 查看开发指南

```bash
cat src/extensions/my_ext/DEVELOPMENT_GUIDE.md
```

开发指南包含：
- 📋 实现检查清单
- 🔧 每个能力的详细实现步骤
- 📝 Payload 字段定义建议
- ✅ 测试实现指导

### 3. 按 TODO 标记实现

开发指南和代码中包含清晰的 TODO 标记，按顺序完成：

1. **定义 Payload 字段** (mod.rs)
2. **实现能力处理器** (capability.rs)
3. **完善测试用例** (tests.rs)
4. **注册到 registry** (src/capabilities/registry.rs)
5. **运行测试验证**

### 4. 运行测试

```bash
# 在 elfiee 项目根目录
cargo test --package elfiee-app --test test_my_ext
```

### 5. 集成到主项目

生成的代码已自动更新以下文件：
- `src/extensions/mod.rs` - 添加模块导出
- `src/capabilities/registry.rs` - 添加能力注册代码

## TDD 开发理念

本工具遵循测试驱动开发（TDD）原则：

1. **先有测试**: 生成的代码包含完整的测试骨架
2. **测试失败**: 初始状态下测试会失败（因为有 `todo!()` 标记）
3. **引导实现**: 通过完成 TODO 标记，让测试逐步通过
4. **验证正确**: 测试全部通过时，功能开发完成

### TDD 流程示例

```bash
# 1. 生成扩展
elfiee-ext-gen create -n my_ext -b my_type -c action

# 2. 运行测试（会失败）
cargo test test_my_ext
# 输出: thread panicked at 'not yet implemented: Implement...'

# 3. 实现 Payload 字段
# 编辑 src/extensions/my_ext/mod.rs

# 4. 实现处理器逻辑
# 编辑 src/extensions/my_ext/my_ext_action.rs

# 5. 完善测试用例
# 编辑 src/extensions/my_ext/tests.rs

# 6. 再次运行测试（应该通过）
cargo test test_my_ext
# 输出: test result: ok. X passed
```

## 字段推断示例

生成器会根据能力名称智能推断 Payload 字段：

| 能力名称 | 推断字段 |
|---------|---------|
| `write` | `content: String` |
| `read` | （无输入字段，仅返回数据） |
| `update` | `content: String` |
| `render` | `template: String`, `data: serde_json::Value` |
| `create` | `initial_content: String` |
| `delete` | `confirm: bool` |
| `search` | `query: String`, `limit: usize` |

推断的字段仅作为建议，在 Payload 定义的注释中提供，开发者可根据实际需求修改。

## 故障排查

### 问题：生成的代码编译失败

**原因**: 可能是 elfiee 主项目的依赖或模型发生了变化。

**解决**:
1. 确保 elfiee 主项目可以正常编译
2. 检查生成的代码中的导入路径是否正确
3. 查看编译错误信息，调整生成的代码

### 问题：测试无法找到

**原因**: 测试模块未正确注册。

**解决**:
```rust
// 在 mod.rs 中确保有
#[cfg(test)]
mod tests;
```

## 高级用法

### 自定义模板

如果需要修改生成的代码模板，可以编辑 `elfiee-ext-gen/templates/` 目录下的模板文件：

- `mod.rs.tera` - 模块文件模板
- `capability.rs.tera` - 能力处理器模板
- `tests.rs.tera` - 测试文件模板
- `DEVELOPMENT_GUIDE.md.tera` - 开发指南模板

修改后重新构建工具即可生效。

### 验证现有扩展

```bash
# 验证扩展代码是否符合规范
elfiee-ext-gen validate \
  --extension-path src/extensions/my_ext
```

## 贡献指南

欢迎贡献！提交 PR 前请确保：

1. 代码通过 `cargo clippy` 检查
2. 所有测试通过：`cargo test`
3. 添加了相应的测试用例
4. 更新了文档

## 相关文档

- [Elfiee 主项目文档](../docs/README.md)
- [扩展开发指南](../docs/guides/EXTENSION_DEVELOPMENT.md)
- [生成器开发计划](docs/generator-dev-plan.md)
- [生成器设计文档](docs/generator-work-design.md)

## 未来工作

### 发布到 crates.io

当前版本需要通过 `cargo install --path .` 从源码安装。计划在未来版本中：

- 发布到 [crates.io](https://crates.io/)
- 用户可通过 `cargo install elfiee-ext-gen` 全局安装
- 无需克隆仓库即可使用

**当前使用方式**:
```bash
# 从 elfiee 项目源码安装
cd /path/to/elfiee/elfiee-ext-gen
cargo install --path .
```

**未来使用方式**:
```bash
# 直接从 crates.io 安装（未来版本）
cargo install elfiee-ext-gen
```

## 许可证

Apache-2.0 License

## 版本历史

### v0.1.0 (2025-11-02)

初始版本，包含核心功能：
- ✅ 扩展骨架生成
- ✅ 智能字段推断
- ✅ TDD 测试生成
- ✅ 开发指南生成
- ✅ 自动注册到 registry
