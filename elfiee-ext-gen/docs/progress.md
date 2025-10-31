# Generator 开发进度跟踪

本文档跟踪 `elfiee-ext-gen` 的开发进度，基于 [generator-dev-plan.md](./generator-dev-plan.md)。

**更新日期**: 2025-10-31
**当前阶段**: Phase 4 - 集成测试（进行中）

## 重要说明

**运行位置**: `elfiee-ext-gen` 必须在 **Elfiee 主项目根目录** 运行
```bash
cd /path/to/elfiee  # 主项目根目录
elfiee-ext-gen create --name todo --capabilities "add_item"
```

**依赖关系**:
- 生成文件到 `src-tauri/src/extensions/`
- 运行测试需要 `src-tauri/` 目录和Cargo环境
- 验证检查需要读取主项目的多个文件（extensions/mod.rs, registry.rs, lib.rs）

---

## Phase 1: 基础设施（1-2天）

### 1.1 项目初始化
- [x] 创建 Cargo 项目
- [x] 配置依赖 (Cargo.toml)
- [x] 设置目录结构
- [x] 创建模块骨架 (lib.rs, mod.rs)

### 1.2 命名转换工具 (`utils/naming.rs`)
- [x] 编写函数签名和文档
- [x] 编写 17 个测试用例
- [x] 修复 unused variable warnings
- [x] **实现 `to_snake_case()`**
- [x] **实现 `to_pascal_case()`**
- [x] **实现 `to_camel_case()`**
- [x] **实现 `capability_to_struct_name()`**
- [x] 所有测试通过 ✅

### 1.3 文件操作工具 (`utils/file_ops.rs`)
- [x] 定义 `FileOperations` 结构
- [x] 编写测试用例 (12个)
  - [x] `test_ensure_dir()`
  - [x] `test_write_and_read_file()`
  - [x] `test_write_file_creates_parent_dirs()`
  - [x] `test_list_rust_files()`
- [x] 实现功能
  - [x] `ensure_dir()`
  - [x] `write_file()`
  - [x] `read_file()`
  - [x] `file_exists()`
  - [x] `list_rust_files()`
- [x] 所有测试通过 ✅

### 1.4 配置模型 (`models/config.rs`)
- [x] 定义 `ExtensionConfig` 结构（含 block_type, with_auth_tests, with_workflow_tests）
- [x] 编写测试用例 (3个 - 按设计文档)
  - [x] `test_valid_config()`
  - [x] `test_invalid_name_with_spaces()`
  - [x] `test_empty_capabilities()`
- [x] 实现 `validate()` 方法（返回类型 Result<(), Vec<String>>）
- [x] 所有测试通过 ✅

---

## Phase 2: 核心模块（3-4天）

### 2.1 模板引擎 (`core/generator.rs`)
- [x] 创建 `Generator` 结构（✅ new() 无参数）
- [x] 定义 `GeneratedFiles` 结构（✅ HashMap<PathBuf, String> + next_steps）
- [x] 编写测试用例 (6个 - 严格按设计文档)
  - [x] `test_generator_new()`
  - [x] `test_infer_fields_for_add_capability()`
  - [x] `test_infer_fields_for_toggle_capability()`
  - [x] `test_generate_extension_creates_all_files()`
  - [x] `test_generated_mod_rs_contains_payload()`
  - [x] `test_generated_capability_has_todo_markers()`
- [x] 实现功能
  - [x] `new()` - 加载模板（无参数）
  - [x] `infer_fields()` - 字段推断
  - [x] `prepare_context()` - 准备上下文
  - [x] `render_template()` - 渲染模板
  - [x] `generate_extension()` - 生成所有文件（返回 HashMap）
- [x] 所有测试通过 ✅

### 2.2 模板文件 (`templates/`)
- [x] 创建 `mod.rs.tera`
- [x] 创建 `capability.rs.tera`
- [x] 创建 `tests.rs.tera`
- [x] 创建 `guide.md.tera`

### 2.3 测试分析器 (`core/analyzer.rs`)
- [x] 创建 `TestAnalyzer` 结构（✅ 从YAML加载）
- [x] 定义数据模型（✅ 完全符合设计文档）
  - [x] `TestFailure` - ✅ matched_pattern: Option<ErrorPattern>
  - [x] `ErrorPattern` - ✅ pattern, category, hint字段
  - [x] `FileLocation` - ✅ line: usize
  - [x] `AnalysisReport` - ✅ total_tests, passing, failing, critical_path, estimated_time
- [x] 编写测试用例 (5个 - 严格按设计文档)
  - [x] `test_parse_failures()`
  - [x] `test_extract_location()`
  - [x] `test_match_pattern_todo()`
  - [x] `test_analyze_report()`
  - [x] `test_compute_critical_path()`
- [x] 新增 `test_compute_critical_path_respects_dependencies()`
- [x] 实现功能
  - [x] `new()` - ✅ 从 rules/error_patterns.yaml 加载
  - [x] `parse_failures()` - ✅ 正则解析cargo test输出
  - [x] `match_pattern()` - ✅ 匹配YAML中的模式
  - [x] `extract_location()` - ✅ 提取文件位置
  - [x] `compute_critical_path()` - ✅ 优先级排序
  - [x] `analyze()` - ✅ 生成完整报告
- [x] 所有测试通过 ✅

### 2.4 规则文件 (`rules/`)
- [x] 创建 `error_patterns.yaml`（5个基础模式）
- [x] 创建 `next_steps.yaml`（Phase 2.5需要）
- [x] 创建 `test_dependencies.yaml`（Phase 2.5需要）
- [ ] **后续任务**：将 `test_dependencies` 从示例依赖替换为自动推断/约定驱动方案（提升通用性）

### 2.5 智能提示生成器 (`core/guide_gen.rs`)
- [x] 创建 `GuideGenerator` 结构
- [x] 编写测试用例 (3个 - 严格按设计文档)
  - [x] `test_format_progress()`
  - [x] `test_format_report_with_failures()`（含 next_steps 提示断言）
  - [x] `test_run_tests()` (ignored)
- [x] 实现功能
  - [x] `new()` - 接收analyzer参数
  - [x] `run_tests()` - 执行cargo test并捕获输出
  - [x] `format_report()` - 格式化报告为人类可读文本
  - [x] `format_progress()` - 生成进度百分比字符串
  - [x] `generate_guide()` - 组合以上功能生成完整指南
- [x] 所有测试通过 ✅

### 2.6 验证器 (`core/validator.rs`)
- [x] 创建 `Validator` 结构
- [x] 定义 `ValidationReport` 结构
- [x] 编写测试用例 (5个 - 严格按设计文档)
  - [x] `test_check_files_exist_all_present()`
  - [x] `test_check_files_exist_missing_mod()`
  - [x] `test_validate_payloads_correct()`
  - [x] `test_validate_payloads_missing_type_derive()`
  - [x] `test_validation_report_summary()`
- [x] 新增 `test_check_registration_success()` / `test_check_registration_missing_entries()`
- [ ] 实现功能（部分完成）
  - [x] `validate_extension()` - 组合所有检查生成报告
  - [x] `check_files_exist()` - 检查mod.rs和capability文件
  - [x] `validate_payloads()` - 正则匹配检查derives
  - [x] `check_registration()` - 实现模块/注册检查
    - [x] 检查 `src-tauri/src/extensions/mod.rs` 导出
    - [x] 检查 `src-tauri/src/capabilities/registry.rs` 注册
    - [x] 检查 `src-tauri/src/lib.rs` Specta类型注册
  - [x] `check_test_coverage()` - 检查#[cfg(test)]和mod tests
- [x] 所有测试通过 ✅

**状态**: Registry 与 Specta 类型检查已通过验证器实现 ✅

---

## Phase 3: 命令实现（2-3天）

### 3.1 Create 命令 (`commands/create.rs`)
- [x] 定义 `CreateCommand` 结构（带 Clap 参数）
- [x] 编写测试用例 (2个)
  - [x] `test_execute_creates_files()`
  - [x] `test_execute_invalid_name()`
- [x] 实现 `execute()` 方法
- [x] 集成到 CLI（主程序 + help）
- [x] 所有测试通过

### 3.2 Guide 命令 (`commands/guide.rs`)
- [x] 定义 `GuideCommand` 结构
- [x] 编写测试用例 (2个)
  - [x] `test_execute_shows_guide()` (ignored)
  - [x] `test_execute_nonexistent_extension()`
- [x] 实现 `execute()` 方法
- [x] 集成到 CLI
- [x] 所有已启用测试通过（忽略项除外）

### 3.3 Validate 命令 (`commands/validate.rs`)
- [x] 定义 `ValidateCommand` 结构
- [x] 编写测试用例 (2个)
  - [x] `test_validate_missing_extension()`
  - [x] `test_validate_success()`
- [x] 实现 `execute()` 方法
- [x] 集成到 CLI
- [x] 所有已启用测试通过（忽略项除外）

- [x] 定义 `Cli` 结构 (clap)
- [x] 定义 `Commands` 枚举
- [x] 实现 main() - 命令路由
- [x] 错误处理
- [x] 帮助信息（含 create/guide/validate 子命令说明）

---

## Phase 4: 集成测试（1-2天）

- [ ] `test_full_lifecycle_directory_extension()`
  - [x] Setup: 创建临时项目 / scaffold `directory_inspector`
  - [ ] Phase 1: 生成 Extension（命令执行自动验证输出）
  - [ ] Phase 2: 运行测试（初始失败）
  - [ ] Phase 3: 获取指南
  - [ ] Phase 4: 模拟开发 - 定义 Payload
  - [ ] Phase 5: 模拟开发 - 实现 Handler
  - [ ] Phase 6: 再次运行测试（部分通过）
  - [ ] Phase 7: 验证
- [ ] `test_create_with_invalid_name()`
- [ ] `test_guide_nonexistent_extension()`
- [ ] 所有集成测试通过

### 4.2 性能测试
- [ ] 生成时间测试（< 1秒）
- [ ] 模板渲染性能
- [ ] 测试分析性能

---

## Phase 5: 文档和发布

### 5.1 文档完善
- [x] extension-dev-quickstart.md
- [x] generator-work-design.md
- [x] generator-dev-plan.md
- [x] progress.md (本文档)
- [ ] README.md
- [ ] CONTRIBUTING.md
- [ ] CHANGELOG.md

### 5.2 代码质量
- [ ] 运行 `cargo clippy` 并修复所有警告
- [ ] 运行 `cargo fmt`
- [ ] 测试覆盖率 ≥ 80%
- [ ] 文档覆盖率 100%

### 5.3 CI/CD
- [ ] GitHub Actions 配置
- [ ] 自动化测试
- [ ] 自动化发布

### 5.4 发布准备
- [ ] 版本号确定
- [ ] License 文件
- [ ] 支持 `cargo install --path elfiee-ext-gen` 体验文档
- [ ] CLI 自动定位项目根目录/路径机制
- [ ] 发布到 crates.io（可选）并在 README 中示例全局命令用法

---

## 里程碑

### ✅ Milestone 0: 项目启动
- [x] 创建项目结构
- [x] 编写设计文档
- [x] 编写开发计划

### ✅ Milestone 1: MVP (100% 完成)
**目标**: 基本功能可用
- [x] Phase 1 完成（基础设施） ✅
- [x] Phase 2 完成（Generator 核心 + 模板通用性增强） ✅
- [x] Phase 3 完成（Create/Guide/Validate CLI 集成 + 并发测试稳定性） ✅

### ✅ 并发测试稳定性修复（Phase 3 收尾）
- 引入 `src/test_support.rs`，统一 `test_lock` / `capture_original_dir` / `restore_original_dir`，所有修改工作目录的测试现均引用
- 修正生成器测试期望，覆盖 `tests.rs` 产物，消除不确定行为
- `cargo test`（含 doctest）在并行模式下稳定通过

### 🔄 Phase 4 进展
- 使用 CLI 在主项目中生成 `directory_inspector` 扩展（block_type=`directory`，capabilities=`scan`,`trust`）作为目录信任场景示例
- 通过 `cargo run --manifest-path elfiee-ext-gen/Cargo.toml -- validate markdown` 验证现有 Markdown 扩展可在不修改代码的情况下通过校验 ✅
  - [x] Generator (模板引擎)
  - [x] Analyzer (测试分析)
  - [x] GuideGenerator (智能提示)
  - [ ] Validator (验证器 - 缺registry检查)
- [ ] Phase 3 部分（create 命令）
- [ ] 生成的 Extension 可以编译

**验收标准**:
```bash
cd /path/to/elfiee  # 主项目根目录
elfiee-ext-gen create --name test --capabilities "add"
cd src-tauri
cargo test test::tests
# 至少有一个测试通过
```

### 🎯 Milestone 2: 功能完善
**目标**: 所有核心功能实现
- [ ] Phase 2 完成（所有核心模块）
- [ ] Phase 3 完成（所有命令）
- [ ] Phase 4 完成（集成测试）

### 🚀 Milestone 3: 生产就绪
**目标**: 可以发布
- [ ] 完整文档
- [ ] 测试覆盖率 ≥ 80%
- [ ] CI/CD 集成
- [ ] 社区反馈

---

## 当前状态

**正在进行**: Phase 4 - 端到端集成测试

**已完成**:
- ✅ Phase 1: 基础设施（命名转换、文件操作、配置模型）
- ✅ Phase 2: 核心模块（100%）
  - ✅ Phase 2.1: 模板引擎（Generator + 4个模板文件）
  - ✅ Phase 2.2: 模板增强（tests.rs.tera生成完整测试骨架）
  - ✅ Phase 2.3: 测试分析器（从YAML加载error_patterns + 模式依赖推断）
  - ✅ Phase 2.4: 规则文件（error_patterns.yaml + test_dependencies.yaml基于模式）
  - ✅ Phase 2.5: 智能提示生成器（GuideGenerator）
  - ✅ Phase 2.6: 验证器（完整registry检查）
- ✅ Phase 3: 命令实现（100%）
  - ✅ Phase 3.1: Create命令 + 自动注册
  - ✅ Phase 3.2: Guide命令 + 智能提示
  - ✅ Phase 3.3: Validate命令 + 完整性检查
  - ✅ Phase 3.4: CLI集成 + 并发测试稳定性

**下一步**:
1. ~~实现 `check_registration()` 的三项检查~~ ✅ 已完成
2. ~~增强模板通用性~~ ✅ 已完成 (test_dependencies.yaml改为模式匹配，tests.rs.tera增强)
3. 进入 Phase 4: 端到端集成测试

**已完成任务数**: ~90 / ~100
**进度**: ~90% (Phase 2&3完全完成，进入Phase 4)

---

## 注意事项

1. **测试先行**: 每个功能都先写测试，看到失败再实现
2. **小步快跑**: 每完成一个小模块就测试通过
3. **及时提交**: 测试通过后立即 git commit
4. **文档同步**: 代码变更时同步更新文档
5. **进度更新**: 完成任务后更新本文档的 checkbox
6. **Ignored测试**: 2个集成测试（guide_gen::test_run_tests, guide::test_execute_shows_guide）需要真实elfiee项目环境，保持ignored状态

---

## 更新日志

- **2025-10-31**: ✅ 检查ignored测试 - 确认2个集成测试需要保持ignored状态（需要真实cargo环境）
- **2025-10-31**: ✅ 改进ignored测试注释 - 添加清晰说明和手动测试步骤
- **2025-10-31**: ✅ 增强模板通用性 - 改进test_dependencies.yaml为基于模式匹配的规则，支持任意extension
- **2025-10-31**: ✅ 更新analyzer.rs支持模式依赖推断，移除硬编码测试名
- **2025-10-31**: ✅ 增强tests.rs.tera模板，生成完整测试骨架（payload测试 + 功能测试 + 授权测试 + 工作流测试）
- **2025-10-31**: ✅ 标注未使用命名函数 (to_camel_case, capability_to_struct_name) 保留供未来使用
- **2025-10-30**: 创建进度跟踪文档
- **2025-10-30**: 完成 Phase 1.1 和 1.2 测试编写
