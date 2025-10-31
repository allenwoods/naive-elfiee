# Generator 工作设计文档

## 目录

1. [概述](#概述)
2. [设计理念](#设计理念)
3. [架构设计](#架构设计)
4. [组件详解](#组件详解)
5. [使用方法](#使用方法)
6. [工作流程](#工作流程)
7. [技术栈](#技术栈)

---

## 概述

### 什么是 Extension Generator？

**elfiee-ext-gen** 是一个 TDD 驱动的脚手架工具，用于快速生成 Extension 骨架代码和测试套件。

### 核心价值

**传统开发方式的问题**：
```
写代码 → 运行 → 报错 → 不知道缺什么 → 查文档 → 修复 → 又报错 → ...
```

**Generator 驱动的 TDD 方式**：
```
运行 Generator → 生成完整测试 + 骨架代码 → 运行测试 →
看失败信息 → 知道该做什么 → 实现 → 测试通过 → 下一个测试
```

### 类比

| 类比对象 | Generator 对应部分 |
|----------|-------------------|
| Python `raise NotImplementedError` | Rust `todo!()` + 详细注释 |
| Django `startapp` | `elfiee-ext-gen create` |
| Rails scaffold | 模板生成 + 测试套件 |
| TDD Red-Green-Refactor | 失败测试 → 实现 → 通过 |

### 关键特性

1. **无需 AI**：完全基于模板和规则
2. **测试驱动**：生成的测试初始全部失败
3. **智能提示**：根据测试失败分析下一步
4. **类型安全**：自动生成 TypeScript 绑定
5. **渐进式**：一步一步引导完成开发

---

## 设计理念

### 1. 失败优先（Fail-First）

```rust
// 生成的代码初始状态
#[capability(id = "todo.add_item", target = "todo")]
fn handle_todo_add(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    // TODO: Step 1 - Deserialize payload
    todo!("Deserialize TodoAddPayload from cmd.payload");
}
```

**运行测试**：
```bash
$ cargo test todo::tests::test_add_item_basic

---- test_add_item_basic stdout ----
thread panicked at 'not yet implemented: Deserialize TodoAddPayload from cmd.payload'
```

**开发者立即知道**：
- 下一步要做什么（反序列化 Payload）
- 在哪个文件的哪一行
- 提示如何实现

### 2. 模板驱动（Template-Driven）

```
用户输入（配置） → 模板引擎 → 生成代码

输入：
  name: "todo"
  capabilities: ["add_item", "toggle_item"]

模板：
  mod.rs.tera
  capability.rs.tera
  tests.rs.tera

输出：
  extensions/todo/mod.rs
  extensions/todo/todo_add.rs
  extensions/todo/todo_toggle.rs
```

### 3. 规则引擎（Rule-Based）

```yaml
# error_patterns.yaml
- pattern: "not yet implemented: (.*)"
  next_action:
    hint: "Remove todo!() and implement the logic"
    file_hint: "Check the TODO comments above this line"

- pattern: "missing field `(\\w+)`"
  next_action:
    hint: "Add 'pub {field}: Type,' to {struct}Payload"
    file_pattern: "*/mod.rs"
```

### 4. 渐进式引导（Progressive Guidance）

```
Phase 1: 定义数据结构
  ├─ test_payload_deserialize ❌ → 实现 Payload → ✅
  └─ test_payload_validation ❌ → 添加验证 → ✅

Phase 2: 实现 Capability
  ├─ test_add_item_basic ❌ → 实现核心逻辑 → ✅
  ├─ test_add_item_validation ❌ → 添加输入检查 → ✅
  └─ test_add_item_preserves ❌ → 保留现有状态 → ✅

Phase 3: 授权测试
  ├─ test_owner_authorized ❌ → 理解 CBAC → ✅
  └─ test_non_owner_with_grant ❌ → Grant 系统 → ✅

Phase 4: 集成测试
  └─ test_full_workflow ❌ → 多 Capability 交互 → ✅
```

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    elfiee-ext-gen CLI                        │
│                   (Clap-based Command Line)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐   ┌──────────┐   ┌──────────────┐
    │ create  │   │  guide   │   │   validate   │
    │ command │   │ command  │   │   command    │
    └────┬────┘   └────┬─────┘   └──────┬───────┘
         │             │                 │
         ▼             ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      核心组件层                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐      │
│  │   Generator  │  │  Analyzer   │  │    Guide     │      │
│  │   模板渲染   │  │  测试分析   │  │   智能提示   │      │
│  └──────────────┘  └─────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据层                                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐      │
│  │   Templates  │  │    Rules    │  │    Config    │      │
│  │  .tera files │  │ .yaml files │  │  .toml file  │      │
│  └──────────────┘  └─────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 目录结构

```
elfiee-ext-gen/
├── Cargo.toml                  # 项目配置
├── README.md                   # 工具说明
├── docs/                       # 文档
│   ├── extension-dev-quickstart.md
│   ├── generator-work-design.md
│   └── generator-dev-plan.md
├── src/
│   ├── main.rs                 # CLI 入口
│   ├── lib.rs                  # 库入口
│   ├── commands/               # 命令实现
│   │   ├── mod.rs
│   │   ├── create.rs           # create 命令
│   │   ├── guide.rs            # guide 命令
│   │   └── validate.rs         # validate 命令
│   ├── core/                   # 核心组件
│   │   ├── mod.rs
│   │   ├── generator.rs        # 模板渲染引擎
│   │   ├── analyzer.rs         # 测试结果分析
│   │   ├── guide_gen.rs        # 智能提示生成
│   │   └── validator.rs        # 代码验证
│   ├── models/                 # 数据模型
│   │   ├── mod.rs
│   │   ├── config.rs           # 配置结构
│   │   ├── template_ctx.rs     # 模板上下文
│   │   ├── analysis.rs         # 分析结果
│   │   └── rules.rs            # 规则定义
│   └── utils/                  # 工具函数
│       ├── mod.rs
│       ├── naming.rs           # 命名转换
│       ├── file_ops.rs         # 文件操作
│       └── test_runner.rs      # 测试运行器
├── templates/                  # 模板文件
│   ├── mod.rs.tera
│   ├── capability.rs.tera
│   ├── tests.rs.tera
│   └── guide.md.tera
├── rules/                      # 规则文件
│   ├── error_patterns.yaml
│   ├── next_steps.yaml
│   └── test_dependencies.yaml   # 后续计划：仅作兜底，默认使用自动依赖推断
└── tests/                      # 集成测试
    ├── integration_test.rs
    └── fixtures/
```

---

## 组件详解

### 1. Generator（模板渲染引擎）

**职责**：根据用户输入和模板生成代码文件

**核心接口**：

```rust
pub struct Generator {
    tera: Tera,                    // 模板引擎
    rules: RuleEngine,             // 规则引擎
}

impl Generator {
    pub fn new() -> Result<Self, String>;

    /// 生成 Extension 骨架
    pub fn generate_extension(
        &self,
        config: &ExtensionConfig,
    ) -> Result<GeneratedFiles, String>;

    /// 生成单个文件
    fn render_file(
        &self,
        template_name: &str,
        context: &Context,
    ) -> Result<String, String>;

    /// 推断常见字段（基于规则）
    fn infer_fields(&self, capability_name: &str) -> Vec<FieldSuggestion>;
}
```

**输入**：

```rust
pub struct ExtensionConfig {
    pub name: String,              // "todo"
    pub block_type: String,        // "todo"
    pub capabilities: Vec<String>, // ["add_item", "toggle_item"]
    pub with_auth_tests: bool,     // true
    pub with_workflow_tests: bool, // true
}
```

**输出**：

```rust
pub struct GeneratedFiles {
    pub files: HashMap<PathBuf, String>,  // 文件路径 → 内容
    pub next_steps: Vec<String>,          // 下一步提示
}
```

**工作流程**：

```
1. 解析配置
   ├─ 验证名称合法性
   ├─ 检查目录是否存在
   └─ 验证 capability 名称

2. 准备上下文
   ├─ 转换命名格式 (snake_case, PascalCase)
   ├─ 推断 Payload 字段（基于规则）
   └─ 生成测试用例列表

3. 渲染模板
   ├─ mod.rs.tera → mod.rs
   ├─ capability.rs.tera × N → capability files
   └─ guide.md.tera → DEVELOPMENT_GUIDE.md

4. 写入文件
   └─ 创建目录 + 写入所有文件
```

### 2. Analyzer（测试分析器）

**职责**：解析 `cargo test` 输出，分析失败原因

**核心接口**：

```rust
pub struct TestAnalyzer {
    error_patterns: Vec<ErrorPattern>,
    test_graph: TestDependencyGraph,
}

impl TestAnalyzer {
    pub fn new() -> Result<Self, String>;

    /// 分析测试输出
    pub fn analyze(&self, test_output: &str) -> AnalysisReport;

    /// 解析失败的测试
    fn parse_failures(&self, output: &str) -> Vec<TestFailure>;

    /// 匹配错误模式
    fn match_error_pattern(&self, error_msg: &str) -> Option<ErrorPattern>;

    /// 计算关键路径（拓扑排序）
    fn compute_critical_path(&self, failures: &[TestFailure]) -> Vec<NextStep>;

    /// 估算完成时间
    fn estimate_time(&self, failures: &[TestFailure]) -> Duration;
}
```

**数据结构**：

```rust
pub struct TestFailure {
    pub test_name: String,          // "test_add_item_basic"
    pub error_message: String,      // 完整错误信息
    pub pattern: Option<ErrorPattern>, // 匹配的错误模式
    pub file_location: FileLocation,   // 文件位置
}

pub struct ErrorPattern {
    pub pattern: String,            // 正则表达式
    pub category: String,           // "todo_marker" | "payload_missing"
    pub severity: Severity,         // Critical | High | Medium | Low
    pub next_action: NextAction,    // 下一步建议
}

pub struct NextAction {
    pub action_type: ActionType,    // ImplementFunction | DefineField
    pub description: String,        // 人类可读描述
    pub hint: String,               // 具体提示
    pub file_hint: Option<String>,  // 文件提示
}

pub struct AnalysisReport {
    pub total_tests: usize,
    pub passing: usize,
    pub failing: Vec<TestFailure>,
    pub critical_path: Vec<NextStep>,
    pub blocked_tests: Vec<String>,
    pub estimated_completion: Duration,
}
```

**工作原理**：

```
1. 运行测试
   cargo test {extension}::tests 2>&1

2. 解析输出（正则表达式）
   ├─ 提取测试名称
   ├─ 提取错误消息
   ├─ 提取文件位置 (file:line)
   └─ 分类失败类型

3. 匹配错误模式
   for pattern in error_patterns:
       if regex.match(error_msg, pattern.pattern):
           return pattern

4. 构建依赖图
   test_full_workflow
       depends_on: [test_add_item, test_toggle_item]

   test_toggle_item
       depends_on: [test_add_item]

   test_add_item
       depends_on: []

5. 计算关键路径（拓扑排序）
   找出没有未满足依赖的测试 → 优先级最高
```

### 3. GuideGenerator（智能提示生成）

**职责**：根据分析结果生成人类可读的提示

**核心接口**：

```rust
pub struct GuideGenerator {
    analyzer: TestAnalyzer,
    templates: HashMap<String, String>,
}

impl GuideGenerator {
    pub fn new(analyzer: TestAnalyzer) -> Self;

    /// 生成开发指南
    pub fn generate_guide(&self, extension_name: &str) -> String;

    /// 运行测试并捕获输出
    fn run_tests(&self, extension_name: &str) -> String;

    /// 格式化分析报告
    fn format_report(&self, report: &AnalysisReport) -> String;
}
```

**输出示例**：

```
📊 Test Status: 2/12 passing (16.7%)

🔴 Critical Path (must fix first):
  1. Define TodoAddPayload fields
     File: src/extensions/todo/mod.rs:8
     Hint: Start with "pub text: String,"
     Why: 10 tests blocked by this

  2. Implement handle_todo_add deserialization
     File: src/extensions/todo/todo_add.rs:15
     Error: not yet implemented: Deserialize TodoAddPayload
     Next: let payload: TodoAddPayload = serde_json::from_value(...)?;

🟡 Blocked (waiting for dependencies):
  - test_full_workflow_add_toggle_remove
    Waiting for: test_add_item_basic, test_toggle_item_basic
    Estimated unblock: after fixing 4 critical issues

💡 Quick Wins (easy tests to pass):
  - test_owner_can_add_items (3 lines, no dependencies)
  - test_list_items_empty (5 lines, no dependencies)

📈 Progress Estimate:
  - Critical path: 4 issues
  - Estimated time: 1.5 - 2 hours to MVP
  - Next milestone: Get test_add_item_basic passing (15 min)

📖 Resources:
  - Guide: elfiee-ext-gen/docs/extension-dev-quickstart.md
  - Reference: src/extensions/markdown/ (similar structure)
  - Rerun: elfiee-ext-gen guide todo
```

### 4. Validator（代码验证）

**职责**：验证生成的代码是否符合规范

**核心接口**：

```rust
pub struct Validator;

impl Validator {
    /// 验证 Extension 结构
    pub fn validate_extension(path: &Path) -> Result<(), Vec<String>>;

    /// 检查文件完整性
    fn check_files_exist(path: &Path) -> Result<(), String>;

    /// 验证 Payload 定义
    fn validate_payloads(content: &str) -> Result<(), Vec<String>>;

    /// 验证注册正确性
    fn validate_registration(extension_name: &str) -> Result<(), Vec<String>>;
}
```

**验证项**：

```
1. 文件存在性
   ✓ mod.rs 存在
   ✓ 每个 capability 文件存在

2. Payload 定义
   ✓ 有 #[derive(Serialize, Deserialize, Type)]
   ✓ 字段有文档注释
   ✓ 没有裸露的 serde_json::Value（应该有具体类型）

3. Capability 定义
   ✓ 使用 #[capability] 宏
   ✓ id 和 target 正确
   ✓ 函数签名正确

4. 注册检查
   ✓ extensions/mod.rs 导出
   ✓ registry.rs 注册
   ✓ lib.rs 注册 Payload 到 Specta

5. 测试覆盖
   ✓ 每个 capability 至少 3 个测试
   ✓ 包含授权测试
   ✓ 包含集成测试
```

---

## 使用方法

### 安装

```bash
# 从主仓库安装
git clone https://github.com/yourorg/elfiee.git
cd elfiee
cargo install --path elfiee-ext-gen

# 验证安装
elfiee-ext-gen --version
```

### 命令列表

#### 1. `create` - 生成 Extension 骨架

**基本用法**：

```bash
elfiee-ext-gen create \
    --name todo \
    --block-type todo \
    --capabilities "add_item,toggle_item,remove_item,list_items"
```

**参数说明**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `--name` | String | ✅ | Extension 名称（snake_case） |
| `--block-type` | String | ✅ | 目标 block_type |
| `--capabilities` | String | ✅ | 逗号分隔的 capability 列表 |
| `--with-auth-tests` | bool | ❌ | 包含授权测试（默认 true） |
| `--with-workflow-tests` | bool | ❌ | 包含集成测试（默认 true） |

**输出**：

```
✓ Created extensions/todo/
  ├─ mod.rs (Payload 定义 + 测试)
  ├─ todo_add.rs (骨架 + TODO)
  ├─ todo_toggle.rs (骨架 + TODO)
  ├─ todo_remove.rs (骨架 + TODO)
  ├─ todo_list.rs (骨架 + TODO)
  └─ DEVELOPMENT_GUIDE.md (开发指南)

✓ Generated 4 capabilities with 12 failing tests

➜ Next Steps:
  1. Run: cargo test todo::tests
  2. Start with: src-tauri/src/extensions/todo/mod.rs:8
  3. Follow guide: extensions/todo/DEVELOPMENT_GUIDE.md
```

#### 2. `guide` - 智能提示

**用法**：

```bash
elfiee-ext-gen guide todo
```

**输出**：（见上面 GuideGenerator 示例）

#### 3. `validate` - 验证代码

**用法**：

```bash
elfiee-ext-gen validate todo
```

**输出**：

```
Validating extension 'todo'...

✓ Files exist
✓ Payload definitions correct
✓ Capabilities registered
✓ Tests present

⚠ Warnings:
  - mod.rs:15: TodoTogglePayload missing doc comment on field 'item_id'
  - Missing integration test for full workflow

Summary: 4/6 checks passed
```

---

## 工作流程

### 完整开发周期

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 0: 规划                                               │
│  - 设计 Extension                                            │
│  - 列出 Capabilities                                         │
│  - 定义 Schema                                               │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: 生成骨架                                           │
│  $ elfiee-ext-gen create --name todo ...                    │
│  → 生成文件 + 失败测试                                        │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: TDD 循环                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. $ cargo test todo::tests                          │   │
│  │    → 看到 12 个失败                                  │   │
│  │                                                       │   │
│  │ 2. $ elfiee-ext-gen guide todo                       │   │
│  │    → "Define TodoAddPayload.text field"              │   │
│  │                                                       │   │
│  │ 3. 编辑 mod.rs，添加字段                             │   │
│  │                                                       │   │
│  │ 4. $ cargo test todo::tests                          │   │
│  │    → 11 个失败（进步了！）                           │   │
│  │                                                       │   │
│  │ 5. $ elfiee-ext-gen guide todo                       │   │
│  │    → "Implement handle_todo_add deserialization"     │   │
│  │                                                       │   │
│  │ 6. 编辑 todo_add.rs，实现逻辑                        │   │
│  │                                                       │   │
│  │ 7. $ cargo test todo::tests::test_add_item_basic     │   │
│  │    → ✅ PASS！                                       │   │
│  │                                                       │   │
│  │ 8. 重复步骤 2-7 直到所有测试通过                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: 集成                                               │
│  1. 注册到 CapabilityRegistry                                │
│  2. 注册 Payload 到 Specta                                   │
│  3. $ pnpm tauri dev → 生成 TypeScript 类型                  │
│  4. $ elfiee-ext-gen validate todo → 验证完整性              │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: 端到端测试                                         │
│  - 前端测试                                                  │
│  - 完整工作流测试                                            │
└─────────────────────────────────────────────────────────────┘
```

### TDD 循环细节

```
┌──────────────┐
│  Run Tests   │
│  cargo test  │
└──────┬───────┘
       │
       ▼ 失败
┌──────────────────────┐
│  Analyze Failures    │
│  elfiee-ext-gen      │
│  guide <extension>   │
└──────┬───────────────┘
       │
       ▼ 知道下一步
┌──────────────────────┐
│  Implement Fix       │
│  编辑代码             │
└──────┬───────────────┘
       │
       ▼
┌──────────────┐
│  Run Tests   │
└──────┬───────┘
       │
       ▼ 通过
┌──────────────┐
│  Next Test   │ ─────┐
└──────────────┘      │
                      │
       ▲──────────────┘
```

---

## 技术栈

### 核心依赖

```toml
[dependencies]
# CLI 框架
clap = { version = "4", features = ["derive"] }

# 模板引擎
tera = "1"

# 序列化
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"

# 正则表达式
regex = "1"

# 文件操作
walkdir = "2"

# 终端美化
colored = "2"
indicatif = "0.17"  # 进度条

# 错误处理
anyhow = "1"
thiserror = "1"

# 测试
[dev-dependencies]
assert_cmd = "2"    # 测试 CLI
predicates = "3"    # 断言帮助
tempfile = "3"      # 临时文件
```

### 外部工具

- **cargo**：运行测试
- **rustfmt**：代码格式化
- **cargo-expand**：宏展开（调试）

---

## 设计决策

### 为什么放在主库中？

1. **版本同步**：Extension API 变化时自动同步
2. **类型共享**：可以直接引用 `elfiee_lib` 的类型
3. **开发便利**：一次 clone 包含所有工具
4. **CI 集成**：统一的测试和发布流程

### 为什么用 Tera 而不是其他模板引擎？

| 模板引擎 | 优势 | 劣势 |
|----------|------|------|
| **Tera** | Jinja2 语法，功能丰富 | 体积较大 |
| Handlebars | 简单，体积小 | 功能较少 |
| Askama | 编译时检查 | 灵活性低 |

**选择 Tera**：
- ✅ 熟悉的语法（类似 Jinja2）
- ✅ 功能丰富（循环、条件、过滤器）
- ✅ 良好的错误提示
- ✅ 活跃维护

---

## 下一步

1. **阅读**：[Generator 开发计划](./generator-dev-plan.md)
2. **实践**：按照开发计划实现 Generator
3. **测试**：使用生成的 Extension 验证工具
4. **迭代**：根据反馈改进模板和规则

**相关文档**：
- [Extension 开发快速指南](./extension-dev-quickstart.md)
- [Generator 开发计划](./generator-dev-plan.md)
