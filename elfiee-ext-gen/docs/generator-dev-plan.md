# Generator 开发计划

## 目录

1. [开发策略](#开发策略)
2. [模块划分](#模块划分)
3. [开发阶段](#开发阶段)
4. [详细实现计划](#详细实现计划)
5. [测试策略](#测试策略)
6. [Generator 生命周期](#generator-生命周期)
7. [里程碑](#里程碑)

---

## 开发策略

### TDD 原则

**测试驱动开发（Test-Driven Development）**：

```
编写失败测试 → 实现最小代码 → 测试通过 → 重构 → 下一个功能
```

**为什么 TDD？**

1. **保证质量**：所有代码都有测试覆盖
2. **设计驱动**：先思考接口，后实现细节
3. **重构安全**：有测试保护，放心重构
4. **文档作用**：测试即文档，展示用法

### 开发顺序

```
Phase 1: 基础设施（工具函数）
  ├─ 命名转换
  ├─ 文件操作
  └─ 配置解析

Phase 2: 核心模块（独立功能）
  ├─ 模板引擎
  ├─ 测试分析器
  └─ 验证器

Phase 3: 命令实现（用户界面）
  ├─ create 命令
  ├─ guide 命令
  └─ validate 命令

Phase 4: 集成测试（端到端）
  └─ 完整生命周期测试
```

---

## 模块划分

### 模块依赖图

```
┌─────────────────────────────────────────────────────┐
│                    main.rs                           │
│                   CLI Entry                          │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌──────────┐
    │ create │  │ guide  │  │ validate │
    └────┬───┘  └───┬────┘  └────┬─────┘
         │          │             │
         └──────────┼─────────────┘
                    ▼
        ┌────────────────────────┐
        │      core/             │
        │  ├─ generator.rs       │
        │  ├─ analyzer.rs        │
        │  ├─ guide_gen.rs       │
        │  └─ validator.rs       │
        └───────────┬────────────┘
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │ models │ │ utils  │ │templates│
    └────────┘ └────────┘ └────────┘
```

---

## 开发阶段

### Phase 1: 基础设施（1-2天）

#### 1.1 项目初始化

**任务**：
- [ ] 创建 Cargo 项目
- [ ] 配置依赖
- [ ] 设置目录结构
- [ ] 编写 README

**测试**：
```bash
cargo build
cargo test
```

#### 1.2 命名转换工具（`utils/naming.rs`）

**接口设计**：

```rust
pub fn to_snake_case(s: &str) -> String;
pub fn to_pascal_case(s: &str) -> String;
pub fn to_camel_case(s: &str) -> String;
pub fn capability_to_struct_name(cap_id: &str) -> String;
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_snake_case() {
        assert_eq!(to_snake_case("TodoAddItem"), "todo_add_item");
        assert_eq!(to_snake_case("HTTPRequest"), "http_request");
        assert_eq!(to_snake_case("already_snake"), "already_snake");
    }

    #[test]
    fn test_to_pascal_case() {
        assert_eq!(to_pascal_case("todo_add_item"), "TodoAddItem");
        assert_eq!(to_pascal_case("http_request"), "HttpRequest");
        assert_eq!(to_pascal_case("AlreadyPascal"), "AlreadyPascal");
    }

    #[test]
    fn test_capability_to_struct_name() {
        assert_eq!(
            capability_to_struct_name("todo.add_item"),
            "TodoAddItemCapability"
        );
        assert_eq!(
            capability_to_struct_name("markdown.write"),
            "MarkdownWriteCapability"
        );
    }
}
```

**实现步骤**：

1. 编写测试（全部失败）
2. 实现 `to_snake_case`（部分通过）
3. 实现 `to_pascal_case`（部分通过）
4. 实现 `capability_to_struct_name`（全部通过）

#### 1.3 文件操作工具（`utils/file_ops.rs`）

**接口设计**：

```rust
pub struct FileOperations;

impl FileOperations {
    /// 创建目录（如果不存在）
    pub fn ensure_dir(path: &Path) -> Result<(), String>;

    /// 写入文件（创建父目录）
    pub fn write_file(path: &Path, content: &str) -> Result<(), String>;

    /// 检查文件是否存在
    pub fn file_exists(path: &Path) -> bool;

    /// 读取文件内容
    pub fn read_file(path: &Path) -> Result<String, String>;

    /// 列出目录下所有 Rust 文件
    pub fn list_rust_files(dir: &Path) -> Result<Vec<PathBuf>, String>;
}
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_ensure_dir() {
        let temp = TempDir::new().unwrap();
        let nested_path = temp.path().join("a/b/c");

        assert!(!nested_path.exists());
        FileOperations::ensure_dir(&nested_path).unwrap();
        assert!(nested_path.exists());
    }

    #[test]
    fn test_write_and_read_file() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");

        FileOperations::write_file(&file_path, "Hello World").unwrap();
        let content = FileOperations::read_file(&file_path).unwrap();

        assert_eq!(content, "Hello World");
    }

    #[test]
    fn test_write_file_creates_parent_dirs() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("a/b/c/test.txt");

        FileOperations::write_file(&file_path, "Test").unwrap();
        assert!(file_path.exists());
    }

    #[test]
    fn test_list_rust_files() {
        let temp = TempDir::new().unwrap();
        FileOperations::write_file(&temp.path().join("a.rs"), "").unwrap();
        FileOperations::write_file(&temp.path().join("b.rs"), "").unwrap();
        FileOperations::write_file(&temp.path().join("c.txt"), "").unwrap();

        let rust_files = FileOperations::list_rust_files(temp.path()).unwrap();
        assert_eq!(rust_files.len(), 2);
    }
}
```

#### 1.4 配置模型（`models/config.rs`）

**数据结构**：

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionConfig {
    /// Extension 名称（snake_case）
    pub name: String,

    /// 目标 block_type
    pub block_type: String,

    /// Capability 列表
    pub capabilities: Vec<String>,

    /// 是否生成授权测试
    #[serde(default = "default_true")]
    pub with_auth_tests: bool,

    /// 是否生成集成测试
    #[serde(default = "default_true")]
    pub with_workflow_tests: bool,
}

fn default_true() -> bool {
    true
}

impl ExtensionConfig {
    /// 验证配置合法性
    pub fn validate(&self) -> Result<(), Vec<String>>;
}
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_config() {
        let config = ExtensionConfig {
            name: "todo".to_string(),
            block_type: "todo".to_string(),
            capabilities: vec!["add_item".to_string()],
            with_auth_tests: true,
            with_workflow_tests: true,
        };

        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_invalid_name_with_spaces() {
        let config = ExtensionConfig {
            name: "todo items".to_string(),
            block_type: "todo".to_string(),
            capabilities: vec!["add".to_string()],
            with_auth_tests: true,
            with_workflow_tests: true,
        };

        let errors = config.validate().unwrap_err();
        assert!(errors.iter().any(|e| e.contains("spaces")));
    }

    #[test]
    fn test_empty_capabilities() {
        let config = ExtensionConfig {
            name: "todo".to_string(),
            block_type: "todo".to_string(),
            capabilities: vec![],
            with_auth_tests: true,
            with_workflow_tests: true,
        };

        let errors = config.validate().unwrap_err();
        assert!(errors.iter().any(|e| e.contains("at least one capability")));
    }
}
```

---

### Phase 2: 核心模块（3-4天）

#### 2.1 模板引擎（`core/generator.rs`）

**接口设计**：

```rust
use tera::{Tera, Context};
use crate::models::config::ExtensionConfig;
use std::collections::HashMap;
use std::path::PathBuf;

pub struct Generator {
    tera: Tera,
}

#[derive(Debug, Clone)]
pub struct GeneratedFiles {
    /// 文件路径 → 文件内容
    pub files: HashMap<PathBuf, String>,

    /// 下一步提示
    pub next_steps: Vec<String>,
}

impl Generator {
    /// 创建生成器实例
    pub fn new() -> Result<Self, String>;

    /// 生成 Extension 所有文件
    pub fn generate_extension(
        &self,
        config: &ExtensionConfig,
    ) -> Result<GeneratedFiles, String>;

    /// 渲染单个模板
    fn render_template(
        &self,
        template_name: &str,
        context: &Context,
    ) -> Result<String, String>;

    /// 准备模板上下文
    fn prepare_context(&self, config: &ExtensionConfig) -> Context;

    /// 基于规则推断 Payload 字段
    fn infer_fields(&self, capability_name: &str) -> Vec<FieldSuggestion>;
}

#[derive(Debug, Clone)]
pub struct FieldSuggestion {
    pub name: String,
    pub type_name: String,
    pub reason: String,
}
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generator_new() {
        let generator = Generator::new();
        assert!(generator.is_ok());
    }

    #[test]
    fn test_infer_fields_for_add_capability() {
        let generator = Generator::new().unwrap();
        let fields = generator.infer_fields("add_item");

        assert!(fields.iter().any(|f| f.name == "text"));
        assert!(fields.iter().any(|f| f.type_name == "String"));
    }

    #[test]
    fn test_infer_fields_for_toggle_capability() {
        let generator = Generator::new().unwrap();
        let fields = generator.infer_fields("toggle_item");

        assert!(fields.iter().any(|f| f.name == "item_id"));
    }

    #[test]
    fn test_generate_extension_creates_all_files() {
        let generator = Generator::new().unwrap();
        let config = ExtensionConfig {
            name: "todo".to_string(),
            block_type: "todo".to_string(),
            capabilities: vec!["add_item".to_string(), "toggle_item".to_string()],
            with_auth_tests: true,
            with_workflow_tests: true,
        };

        let result = generator.generate_extension(&config).unwrap();

        // 验证文件数量
        assert_eq!(result.files.len(), 4); // mod.rs + 2 capabilities + guide.md

        // 验证 mod.rs 存在
        assert!(result.files.keys().any(|p| p.ends_with("mod.rs")));

        // 验证 capability 文件存在
        assert!(result.files.keys().any(|p| p.ends_with("todo_add_item.rs")));
        assert!(result.files.keys().any(|p| p.ends_with("todo_toggle_item.rs")));

        // 验证指南存在
        assert!(result.files.keys().any(|p| p.ends_with("DEVELOPMENT_GUIDE.md")));
    }

    #[test]
    fn test_generated_mod_rs_contains_payload() {
        let generator = Generator::new().unwrap();
        let config = ExtensionConfig {
            name: "todo".to_string(),
            block_type: "todo".to_string(),
            capabilities: vec!["add_item".to_string()],
            with_auth_tests: true,
            with_workflow_tests: true,
        };

        let result = generator.generate_extension(&config).unwrap();
        let mod_content = result.files.iter()
            .find(|(p, _)| p.ends_with("mod.rs"))
            .map(|(_, c)| c)
            .unwrap();

        assert!(mod_content.contains("TodoAddItemPayload"));
        assert!(mod_content.contains("#[derive(Debug, Clone, Serialize, Deserialize, Type)]"));
    }

    #[test]
    fn test_generated_capability_has_todo_markers() {
        let generator = Generator::new().unwrap();
        let config = ExtensionConfig {
            name: "todo".to_string(),
            block_type: "todo".to_string(),
            capabilities: vec!["add_item".to_string()],
            with_auth_tests: true,
            with_workflow_tests: true,
        };

        let result = generator.generate_extension(&config).unwrap();
        let cap_content = result.files.iter()
            .find(|(p, _)| p.ends_with("todo_add_item.rs"))
            .map(|(_, c)| c)
            .unwrap();

        assert!(cap_content.contains("todo!("));
        assert!(cap_content.contains("TODO:"));
        assert!(cap_content.contains("#[capability(id = \"todo.add_item\""));
    }
}
```

**实现步骤**：

1. 编写所有测试（全部失败）
2. 实现 `Generator::new()` - 加载模板
3. 实现 `infer_fields()` - 基于规则推断字段
4. 实现 `prepare_context()` - 准备模板上下文
5. 实现 `render_template()` - 渲染单个模板
6. 实现 `generate_extension()` - 生成所有文件
7. 所有测试通过

#### 2.2 测试分析器（`core/analyzer.rs`）

**接口设计**：

```rust
use regex::Regex;
use std::collections::HashMap;
use std::time::Duration;

pub struct TestAnalyzer {
    error_patterns: Vec<ErrorPattern>,
}

#[derive(Debug, Clone)]
pub struct TestFailure {
    pub test_name: String,
    pub error_message: String,
    pub file_location: Option<FileLocation>,
    pub matched_pattern: Option<ErrorPattern>,
}

#[derive(Debug, Clone)]
pub struct FileLocation {
    pub file: String,
    pub line: usize,
}

#[derive(Debug, Clone)]
pub struct ErrorPattern {
    pub pattern: String,
    pub category: String,
    pub hint: String,
}

#[derive(Debug, Clone)]
pub struct AnalysisReport {
    pub total_tests: usize,
    pub passing: usize,
    pub failing: Vec<TestFailure>,
    pub critical_path: Vec<TestFailure>,
    pub estimated_time: Duration,
}

impl TestAnalyzer {
    /// 创建分析器实例
    pub fn new() -> Result<Self, String>;

    /// 分析测试输出
    pub fn analyze(&self, test_output: &str) -> AnalysisReport;

    /// 解析失败的测试
    fn parse_failures(&self, output: &str) -> Vec<TestFailure>;

    /// 匹配错误模式
    fn match_pattern(&self, error_msg: &str) -> Option<ErrorPattern>;

    /// 提取文件位置
    fn extract_location(&self, error_msg: &str) -> Option<FileLocation>;

    /// 计算关键路径
    fn compute_critical_path(&self, failures: &[TestFailure]) -> Vec<TestFailure>;
}
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_TEST_OUTPUT: &str = r#"
running 5 tests
test todo::tests::test_add_item_basic ... FAILED
test todo::tests::test_toggle_item ... FAILED
test todo::tests::test_owner_auth ... ok
test todo::tests::test_full_workflow ... FAILED
test todo::tests::test_validation ... ok

failures:

---- todo::tests::test_add_item_basic stdout ----
thread 'todo::tests::test_add_item_basic' panicked at 'not yet implemented: Deserialize TodoAddPayload from cmd.payload', src/extensions/todo/todo_add.rs:15:5
"#;

    #[test]
    fn test_parse_failures() {
        let analyzer = TestAnalyzer::new().unwrap();
        let failures = analyzer.parse_failures(SAMPLE_TEST_OUTPUT);

        assert_eq!(failures.len(), 3);
        assert!(failures.iter().any(|f| f.test_name.contains("test_add_item_basic")));
    }

    #[test]
    fn test_extract_location() {
        let analyzer = TestAnalyzer::new().unwrap();
        let error = "panicked at 'message', src/extensions/todo/todo_add.rs:15:5";

        let location = analyzer.extract_location(error).unwrap();
        assert_eq!(location.file, "src/extensions/todo/todo_add.rs");
        assert_eq!(location.line, 15);
    }

    #[test]
    fn test_match_pattern_todo() {
        let analyzer = TestAnalyzer::new().unwrap();
        let error = "not yet implemented: Deserialize payload";

        let pattern = analyzer.match_pattern(error).unwrap();
        assert_eq!(pattern.category, "todo_marker");
        assert!(pattern.hint.contains("implement"));
    }

    #[test]
    fn test_analyze_report() {
        let analyzer = TestAnalyzer::new().unwrap();
        let report = analyzer.analyze(SAMPLE_TEST_OUTPUT);

        assert_eq!(report.total_tests, 5);
        assert_eq!(report.passing, 2);
        assert_eq!(report.failing.len(), 3);
    }

    #[test]
    fn test_compute_critical_path() {
        let analyzer = TestAnalyzer::new().unwrap();
        let failures = vec![
            TestFailure {
                test_name: "test_add_item".to_string(),
                error_message: "todo!()".to_string(),
                file_location: None,
                matched_pattern: Some(ErrorPattern {
                    pattern: "todo".to_string(),
                    category: "todo_marker".to_string(),
                    hint: "Implement".to_string(),
                }),
            },
            TestFailure {
                test_name: "test_workflow".to_string(),
                error_message: "depends on add_item".to_string(),
                file_location: None,
                matched_pattern: None,
            },
        ];

        let critical = analyzer.compute_critical_path(&failures);

        // test_add_item 应该在 critical path 中（无依赖）
        assert!(critical.iter().any(|f| f.test_name == "test_add_item"));
    }
}
```

#### 2.3 智能提示生成器（`core/guide_gen.rs`）

**接口设计**：

```rust
use crate::core::analyzer::{AnalysisReport, TestAnalyzer};
use std::process::Command;

pub struct GuideGenerator {
    analyzer: TestAnalyzer,
}

impl GuideGenerator {
    pub fn new(analyzer: TestAnalyzer) -> Self;

    /// 生成开发指南
    pub fn generate_guide(&self, extension_name: &str) -> Result<String, String>;

    /// 运行测试并捕获输出
    fn run_tests(&self, extension_name: &str) -> Result<String, String>;

    /// 格式化报告为人类可读
    fn format_report(&self, report: &AnalysisReport) -> String;

    /// 生成进度条
    fn format_progress(&self, passing: usize, total: usize) -> String;
}
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_progress() {
        let analyzer = TestAnalyzer::new().unwrap();
        let guide_gen = GuideGenerator::new(analyzer);

        let progress = guide_gen.format_progress(3, 10);
        assert!(progress.contains("30%"));
        assert!(progress.contains("3/10"));
    }

    #[test]
    fn test_format_report_with_failures() {
        let analyzer = TestAnalyzer::new().unwrap();
        let guide_gen = GuideGenerator::new(analyzer);

        let report = AnalysisReport {
            total_tests: 10,
            passing: 7,
            failing: vec![
                TestFailure {
                    test_name: "test_add_item".to_string(),
                    error_message: "todo!()".to_string(),
                    file_location: Some(FileLocation {
                        file: "todo_add.rs".to_string(),
                        line: 15,
                    }),
                    matched_pattern: Some(ErrorPattern {
                        pattern: "todo".to_string(),
                        category: "todo_marker".to_string(),
                        hint: "Implement the function".to_string(),
                    }),
                },
            ],
            critical_path: vec![],
            estimated_time: Duration::from_secs(900),
        };

        let formatted = guide_gen.format_report(&report);

        assert!(formatted.contains("7/10"));
        assert!(formatted.contains("test_add_item"));
        assert!(formatted.contains("todo_add.rs:15"));
        assert!(formatted.contains("Implement the function"));
    }

    // 注意：run_tests 需要实际的测试环境，可以用 mock
    #[test]
    #[ignore] // 需要实际项目环境
    fn test_run_tests() {
        let analyzer = TestAnalyzer::new().unwrap();
        let guide_gen = GuideGenerator::new(analyzer);

        let result = guide_gen.run_tests("todo");
        assert!(result.is_ok());
    }
}
```

#### 2.4 验证器（`core/validator.rs`）

**接口设计**：

```rust
use std::path::Path;

pub struct Validator;

#[derive(Debug, Clone)]
pub struct ValidationReport {
    pub passed: Vec<String>,
    pub failed: Vec<String>,
    pub warnings: Vec<String>,
}

impl Validator {
    /// 验证 Extension 完整性
    pub fn validate_extension(path: &Path) -> ValidationReport;

    /// 检查文件存在性
    fn check_files_exist(path: &Path) -> Result<Vec<String>, Vec<String>>;

    /// 验证 Payload 定义
    fn validate_payloads(content: &str) -> Result<Vec<String>, Vec<String>>;

    /// 检查注册正确性
    fn check_registration(extension_name: &str) -> Result<Vec<String>, Vec<String>>;

    /// 检查测试覆盖率
    fn check_test_coverage(path: &Path) -> Result<Vec<String>, Vec<String>>;
}
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;

    #[test]
    fn test_check_files_exist_all_present() {
        let temp = TempDir::new().unwrap();
        let ext_path = temp.path().join("todo");
        fs::create_dir(&ext_path).unwrap();
        fs::write(ext_path.join("mod.rs"), "").unwrap();
        fs::write(ext_path.join("todo_add.rs"), "").unwrap();

        let result = Validator::check_files_exist(&ext_path);
        assert!(result.is_ok());
    }

    #[test]
    fn test_check_files_exist_missing_mod() {
        let temp = TempDir::new().unwrap();
        let ext_path = temp.path().join("todo");
        fs::create_dir(&ext_path).unwrap();
        // mod.rs 不存在

        let result = Validator::check_files_exist(&ext_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().iter().any(|e| e.contains("mod.rs")));
    }

    #[test]
    fn test_validate_payloads_correct() {
        let content = r#"
        #[derive(Serialize, Deserialize, Type)]
        pub struct TodoAddPayload {
            pub text: String,
        }
        "#;

        let result = Validator::validate_payloads(content);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_payloads_missing_type_derive() {
        let content = r#"
        #[derive(Serialize, Deserialize)]
        pub struct TodoAddPayload {
            pub text: String,
        }
        "#;

        let result = Validator::validate_payloads(content);
        assert!(result.is_err());
        assert!(result.unwrap_err().iter().any(|e| e.contains("Type")));
    }

    #[test]
    fn test_validation_report_summary() {
        let report = ValidationReport {
            passed: vec!["Files exist".to_string(), "Payloads correct".to_string()],
            failed: vec!["Registration missing".to_string()],
            warnings: vec!["Missing doc comments".to_string()],
        };

        assert_eq!(report.passed.len(), 2);
        assert_eq!(report.failed.len(), 1);
        assert_eq!(report.warnings.len(), 1);
    }
}
```

---

### Phase 3: 命令实现（2-3天）

#### 3.1 Create 命令（`commands/create.rs`）

**接口设计**：

```rust
use clap::Args;
use crate::core::generator::Generator;
use crate::models::config::ExtensionConfig;

#[derive(Args, Debug)]
pub struct CreateCommand {
    /// Extension 名称
    #[arg(short, long)]
    pub name: String,

    /// Block 类型
    #[arg(short, long)]
    pub block_type: String,

    /// 逗号分隔的 Capability 列表
    #[arg(short, long)]
    pub capabilities: String,

    /// 包含授权测试
    #[arg(long, default_value = "true")]
    pub with_auth_tests: bool,

    /// 包含集成测试
    #[arg(long, default_value = "true")]
    pub with_workflow_tests: bool,
}

impl CreateCommand {
    pub fn execute(&self) -> Result<(), String>;
}
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::env;

    #[test]
    fn test_execute_creates_files() {
        let temp = TempDir::new().unwrap();
        env::set_current_dir(temp.path()).unwrap();

        let cmd = CreateCommand {
            name: "todo".to_string(),
            block_type: "todo".to_string(),
            capabilities: "add_item,toggle_item".to_string(),
            with_auth_tests: true,
            with_workflow_tests: true,
        };

        let result = cmd.execute();
        assert!(result.is_ok());

        // 验证文件创建
        let ext_path = temp.path().join("src-tauri/src/extensions/todo");
        assert!(ext_path.join("mod.rs").exists());
        assert!(ext_path.join("todo_add_item.rs").exists());
    }

    #[test]
    fn test_execute_invalid_name() {
        let cmd = CreateCommand {
            name: "invalid name".to_string(), // 包含空格
            block_type: "todo".to_string(),
            capabilities: "add".to_string(),
            with_auth_tests: true,
            with_workflow_tests: true,
        };

        let result = cmd.execute();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("invalid"));
    }
}
```

#### 3.2 Guide 命令（`commands/guide.rs`）

**接口设计**：

```rust
use clap::Args;
use crate::core::{analyzer::TestAnalyzer, guide_gen::GuideGenerator};

#[derive(Args, Debug)]
pub struct GuideCommand {
    /// Extension 名称
    pub name: String,
}

impl GuideCommand {
    pub fn execute(&self) -> Result<(), String>;
}
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // 需要实际项目环境
    fn test_execute_shows_guide() {
        let cmd = GuideCommand {
            name: "todo".to_string(),
        };

        let result = cmd.execute();
        assert!(result.is_ok());
    }

    #[test]
    fn test_execute_nonexistent_extension() {
        let cmd = GuideCommand {
            name: "nonexistent".to_string(),
        };

        let result = cmd.execute();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }
}
```

#### 3.3 Validate 命令（`commands/validate.rs`）

**接口设计**：

```rust
use clap::Args;
use crate::core::validator::Validator;

#[derive(Args, Debug)]
pub struct ValidateCommand {
    /// Extension 名称
    pub name: String,
}

impl ValidateCommand {
    pub fn execute(&self) -> Result<(), String>;
}
```

**测试先行**：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // 需要实际项目环境
    fn test_execute_validates_extension() {
        let cmd = ValidateCommand {
            name: "markdown".to_string(), // 使用已有的 extension
        };

        let result = cmd.execute();
        assert!(result.is_ok());
    }
}
```

#### 3.4 CLI 入口（`main.rs`）

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "elfiee-ext-gen")]
#[command(about = "Extension generator for Elfiee", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a new extension with TDD scaffolding
    Create(CreateCommand),

    /// Show development guide based on test failures
    Guide(GuideCommand),

    /// Validate extension structure and registration
    Validate(ValidateCommand),
}

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::Create(cmd) => cmd.execute(),
        Commands::Guide(cmd) => cmd.execute(),
        Commands::Validate(cmd) => cmd.execute(),
    };

    if let Err(e) = result {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}
```

---

### Phase 4: 集成测试（1-2天）

#### 4.1 端到端测试（`tests/integration_test.rs`）

**测试生命周期**：

```rust
use assert_cmd::Command;
use predicates::prelude::*;
use tempfile::TempDir;
use std::fs;

#[test]
fn test_full_lifecycle_todo_extension() {
    // ========================================
    // Setup: 创建临时项目
    // ========================================
    let temp = TempDir::new().unwrap();
    let project_root = temp.path();

    // 模拟 Elfiee 项目结构
    fs::create_dir_all(project_root.join("src-tauri/src/extensions")).unwrap();
    fs::create_dir_all(project_root.join("src-tauri/src/capabilities")).unwrap();

    // ========================================
    // Phase 1: 生成 Extension
    // ========================================
    let mut cmd = Command::cargo_bin("elfiee-ext-gen").unwrap();
    cmd.current_dir(project_root)
        .arg("create")
        .arg("--name")
        .arg("todo")
        .arg("--block-type")
        .arg("todo")
        .arg("--capabilities")
        .arg("add_item,toggle_item");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Created extensions/todo/"));

    // 验证文件创建
    let ext_path = project_root.join("src-tauri/src/extensions/todo");
    assert!(ext_path.join("mod.rs").exists());
    assert!(ext_path.join("todo_add_item.rs").exists());
    assert!(ext_path.join("DEVELOPMENT_GUIDE.md").exists());

    // ========================================
    // Phase 2: 运行测试（初始全部失败）
    // ========================================
    let test_output = std::process::Command::new("cargo")
        .args(&["test", "todo::tests", "--", "--nocapture"])
        .current_dir(project_root.join("src-tauri"))
        .output()
        .unwrap();

    let stderr = String::from_utf8_lossy(&test_output.stderr);
    assert!(stderr.contains("FAILED")); // 初始测试应该失败

    // ========================================
    // Phase 3: 获取指南
    // ========================================
    let mut cmd = Command::cargo_bin("elfiee-ext-gen").unwrap();
    cmd.current_dir(project_root)
        .arg("guide")
        .arg("todo");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Critical Path"))
        .stdout(predicate::str::contains("Define TodoAddItemPayload"));

    // ========================================
    // Phase 4: 模拟开发 - 定义 Payload
    // ========================================
    let mod_content = fs::read_to_string(ext_path.join("mod.rs")).unwrap();
    let updated_mod = mod_content.replace(
        "// TODO: Define payload fields",
        "pub text: String,"
    );
    fs::write(ext_path.join("mod.rs"), updated_mod).unwrap();

    // ========================================
    // Phase 5: 模拟开发 - 实现 Handler
    // ========================================
    let cap_content = fs::read_to_string(ext_path.join("todo_add_item.rs")).unwrap();
    let updated_cap = cap_content.replace(
        r#"todo!("Deserialize TodoAddItemPayload")"#,
        r#"let payload: TodoAddItemPayload = serde_json::from_value(cmd.payload.clone())?;"#
    );
    fs::write(ext_path.join("todo_add_item.rs"), updated_cap).unwrap();

    // ========================================
    // Phase 6: 再次运行测试（部分通过）
    // ========================================
    let test_output = std::process::Command::new("cargo")
        .args(&["test", "todo::tests::test_add_item_basic"])
        .current_dir(project_root.join("src-tauri"))
        .output()
        .unwrap();

    let stderr = String::from_utf8_lossy(&test_output.stderr);
    // 这个测试可能仍然失败，但失败原因应该不同了
    assert!(!stderr.contains("not yet implemented"));

    // ========================================
    // Phase 7: 验证
    // ========================================
    let mut cmd = Command::cargo_bin("elfiee-ext-gen").unwrap();
    cmd.current_dir(project_root)
        .arg("validate")
        .arg("todo");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Files exist"));
}

#[test]
fn test_create_with_invalid_name() {
    let temp = TempDir::new().unwrap();

    let mut cmd = Command::cargo_bin("elfiee-ext-gen").unwrap();
    cmd.current_dir(temp.path())
        .arg("create")
        .arg("--name")
        .arg("invalid name")  // 包含空格
        .arg("--block-type")
        .arg("test")
        .arg("--capabilities")
        .arg("test");

    cmd.assert()
        .failure()
        .stderr(predicate::str::contains("invalid"));
}

#[test]
fn test_guide_nonexistent_extension() {
    let temp = TempDir::new().unwrap();

    let mut cmd = Command::cargo_bin("elfiee-ext-gen").unwrap();
    cmd.current_dir(temp.path())
        .arg("guide")
        .arg("nonexistent");

    cmd.assert()
        .failure()
        .stderr(predicate::str::contains("not found"));
}
```

---

## 测试策略

### 测试金字塔

```
        /\
       /E2E\        集成测试（1-2个）- test_full_lifecycle
      /------\
     /  命令  \      命令测试（3个） - create/guide/validate
    /----------\
   /  核心模块  \    模块测试（4个） - generator/analyzer/guide/validator
  /--------------\
 /    工具函数    \   单元测试（10+个） - naming/file_ops/config
/------------------\
```

### 测试覆盖率目标

- **单元测试**：≥ 90%
- **集成测试**：≥ 80%
- **关键路径**：100%

### 运行测试

```bash
# 运行所有测试
cargo test

# 运行单元测试
cargo test --lib

# 运行集成测试
cargo test --test integration_test

# 运行特定模块测试
cargo test generator::tests

# 测试覆盖率
cargo tarpaulin --out Html
```

---

## Generator 生命周期

### 类比：集成测试流程

Generator 的使用生命周期类似于编写和运行集成测试：

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 0: Setup（准备环境）                                  │
│  类比：创建测试数据库、初始化 fixtures                       │
│                                                              │
│  Generator: $ elfiee-ext-gen create --name todo ...         │
│  → 生成骨架代码 + 失败测试                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Red（红灯阶段）                                    │
│  类比：编写失败的测试用例                                    │
│                                                              │
│  Generator: $ cargo test todo::tests                        │
│  → 所有测试失败（预期行为）                                  │
│  → 查看失败信息                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Guide（智能提示）                                  │
│  类比：查看测试失败原因，决定下一步                          │
│                                                              │
│  Generator: $ elfiee-ext-gen guide todo                     │
│  → 分析失败模式                                              │
│  → 提示下一步应该做什么                                      │
│  → 估算完成时间                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: Implement（实现代码）                              │
│  类比：编写业务逻辑使测试通过                                │
│                                                              │
│  Developer: 编辑生成的文件                                   │
│  → 定义 Payload 字段                                         │
│  → 实现 Handler 逻辑                                         │
│  → 移除 todo!() 标记                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: Green（绿灯阶段）                                  │
│  类比：测试通过                                              │
│                                                              │
│  Generator: $ cargo test todo::tests                        │
│  → 部分测试通过 ✅                                           │
│  → 还有失败 ❌ → 返回 Phase 2                                │
│  → 所有通过 ✅ → 进入 Phase 5                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 5: Refactor（重构优化）                               │
│  类比：重构代码，优化实现                                    │
│                                                              │
│  Developer: 优化代码                                         │
│  → 添加文档注释                                              │
│  → 提取重复逻辑                                              │
│  → 改进错误处理                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 6: Integration（集成系统）                            │
│  类比：将测试模块集成到 CI/CD                                │
│                                                              │
│  Generator: $ elfiee-ext-gen validate todo                  │
│  → 检查注册完整性                                            │
│  → 验证 TypeScript 类型                                      │
│  → 生成验证报告                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 7: E2E Testing（端到端测试）                          │
│  类比：运行完整的集成测试套件                                │
│                                                              │
│  Developer: 前端 + 后端测试                                  │
│  → 编写 UI 组件                                              │
│  → 运行 Tauri app                                            │
│  → 完整工作流测试                                            │
└─────────────────────────────────────────────────────────────┘
```

### 关键对比

| 阶段 | 集成测试 | Generator |
|------|----------|-----------|
| **Setup** | 初始化测试环境 | `elfiee-ext-gen create` |
| **Red** | 编写失败测试 | 生成带 `todo!()` 的代码 |
| **Analyze** | 查看 assertion 失败 | `elfiee-ext-gen guide` |
| **Green** | 实现代码使测试通过 | 移除 `todo!()` 实现逻辑 |
| **Verify** | 运行测试验证 | `cargo test` |
| **Refactor** | 优化实现 | 添加文档、重构 |
| **Validate** | CI/CD 检查 | `elfiee-ext-gen validate` |

### 迭代循环

```
1. create    → 生成骨架（一次性）
              ↓
2. test      → 运行测试
              ↓
3. guide     → 查看提示   ← ─┐
              ↓               │
4. implement → 编写代码       │
              ↓               │
5. test      → 运行测试       │
              ↓               │
              通过？          │
              ├─ NO  ─────────┘
              └─ YES
              ↓
6. validate  → 最终验证
              ↓
7. integrate → 系统集成
```

---

## 里程碑

### Milestone 1: MVP（1周）

**目标**：基本功能可用

- [x] Phase 1 完成（基础设施）
- [x] Phase 2 完成（核心模块）
- [x] Phase 3 部分（create 命令）
- [ ] 生成的 Extension 可以编译
- [ ] 基本的测试覆盖

**验收标准**：

```bash
elfiee-ext-gen create --name test --capabilities "add"
cd src-tauri
cargo test test::tests
# 至少有一个测试通过
```

### Milestone 2: 功能完善（2周）

**目标**：所有核心功能实现

- [ ] Phase 3 完成（所有命令）
- [ ] Phase 4 完成（集成测试）
- [ ] 完善的错误处理
- [ ] 良好的用户体验

**验收标准**：

```bash
# 完整生命周期
elfiee-ext-gen create --name todo --capabilities "add,toggle,remove"
cargo test todo::tests  # 初始失败
elfiee-ext-gen guide todo  # 显示提示
# ... 实现代码 ...
cargo test todo::tests  # 全部通过
elfiee-ext-gen validate todo  # 验证通过
```

### Milestone 3: 生产就绪（3周）

**目标**：可以发布

- [ ] 完整文档
- [ ] 性能优化
- [ ] 错误信息改进
- [ ] CI/CD 集成
- [ ] 发布到 crates.io

**验收标准**：

- 测试覆盖率 ≥ 80%
- 文档完整
- 通过实际项目验证
- 社区反馈收集

---

## 开发检查清单

### Phase 1: 基础设施
- [ ] 项目初始化
- [ ] 命名转换工具 + 测试
- [ ] 文件操作工具 + 测试
- [ ] 配置模型 + 测试

### Phase 2: 核心模块
- [ ] 模板引擎 + 测试
- [ ] 测试分析器 + 测试
- [ ] 智能提示生成器 + 测试
- [ ] 验证器 + 测试

### Phase 3: 命令实现
- [ ] Create 命令 + 测试
- [ ] Guide 命令 + 测试
- [ ] Validate 命令 + 测试
- [ ] CLI 入口

### Phase 4: 集成测试
- [ ] 完整生命周期测试
- [ ] 错误场景测试
- [ ] 性能测试

### Phase 5: 文档和发布
- [ ] README 编写
- [ ] API 文档生成
- [ ] 用户指南编写
- [ ] 发布准备
  - [ ] 支持 `cargo install --path elfiee-ext-gen` 的安装体验
  - [ ] 提供 CLI 自动定位项目根目录/路径的改进方案
  - [ ] 准备发布到 crates.io（可选）并在 README 中加入全局命令用法示例

---

## 下一步行动

1. **立即开始**：Phase 1 - 基础设施
   - 创建项目结构
   - 实现命名转换（第一个 TDD 循环）

2. **并行工作**：模板设计
   - 编写 Tera 模板
   - 准备规则文件（YAML）

3. **持续迭代**：每完成一个模块
   - 运行所有测试
   - 更新文档
   - 提交代码

**开始命令**：

```bash
cargo new --bin elfiee-ext-gen
cd elfiee-ext-gen
mkdir -p src/{commands,core,models,utils} templates rules tests
```

**相关文档**：
- [Extension 开发快速指南](./extension-dev-quickstart.md)
- [Generator 工作设计](./generator-work-design.md)
