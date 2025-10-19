<!--
Sync Impact Report:
Version change: 1.0.0 → 1.1.0
Modified principles: 
  - Performance Requirements: Changed from strict performance standards to design clarity focus
  - Technology Stack: Simplified state management to React Context only
  - Architecture: Added "Let it Crash" principle for error handling
Added sections: None
Removed sections: None
Templates requiring updates:
  ✅ plan-template.md - Performance requirements and state management updated
  ✅ spec-template.md - Performance requirements aligned with new philosophy
  ✅ tasks-template.md - No changes needed (testing standards remain the same)
Follow-up TODOs: None
-->

# Naive ElfIEE Constitution

## Core Principles

### I. Code Quality First (NON-NEGOTIABLE)
所有代码必须遵循严格的质量标准：Rust 代码使用 `clippy` 和 `rustfmt` 进行静态分析和格式化；React 代码使用 ESLint 和 Prettier 进行一致性和质量检查；所有公共 API 必须有完整的文档注释；代码复杂度必须保持在可维护范围内，复杂逻辑必须分解为更小的函数。

### II. Test-Driven Development
TDD 是强制性的：测试先行 → 用户确认 → 测试失败 → 然后实现；Red-Green-Refactor 循环严格执行；Rust 后端必须有单元测试覆盖核心业务逻辑；React 前端组件必须有单元测试和集成测试；所有用户场景必须通过端到端测试验证。

### III. User Experience Consistency
UI/UX 必须保持一致性：使用 Shadcn/ui 组件库确保视觉一致性；所有交互必须符合现代桌面应用的用户期望；响应式设计原则适用于不同屏幕尺寸；错误处理和加载状态必须有统一的用户体验；可访问性标准必须满足 WCAG 2.1 AA 级别。

### IV. Performance Requirements
该项目的目标是理清应用设计和基本业务逻辑，不需要满足严格的性能标准。非必要不进行额外的性能优化，特别是可能会导致代码逻辑不清晰的性能优化。


### V. Technology Stack Constraints
严格遵循 Tauri 最佳实践：Rust 作为后端核心语言，React + TypeScript 作为前端框架；使用 Shadcn/ui 作为 UI 组件库；状态管理优先使用React Context，避免过度工程化；数据持久化使用 SQLite（通过 Tauri 插件）或本地文件系统；避免引入不必要的依赖和复杂性。

## Code Quality Standards

### Rust Backend Standards
- 所有公共函数必须有文档注释和示例
- 错误处理必须使用 `Result<T, E>` 类型，避免 panic
- 使用 `clippy` 进行代码质量检查，零警告要求
- 代码覆盖率目标：核心业务逻辑 ≥ 90%

### React Frontend Standards  
- 使用 TypeScript 进行类型安全
- 组件必须遵循单一职责原则
- 使用 React.memo 和 useMemo 优化性能
- 所有组件必须有 PropTypes 或 TypeScript 接口定义

### Code Review Requirements
- 所有 PR 必须通过自动化测试和 linting 检查
- 代码审查必须验证性能影响和用户体验一致性
- 复杂逻辑必须提供充分的测试覆盖
- 文档更新必须与代码变更同步

## User Experience Consistency

### Design System
- 使用 Shadcn/ui 作为唯一 UI 组件库
- 颜色、字体、间距必须遵循统一的设计令牌
- 所有交互状态（hover、focus、disabled）必须一致
- 图标使用统一的图标库（Lucide React）

### Accessibility Standards
- 所有交互元素必须支持键盘导航
- 颜色对比度必须满足 WCAG 2.1 AA 标准
- 屏幕阅读器支持必须完整
- 错误消息必须清晰且可访问

### Responsive Behavior
- 应用必须适应不同屏幕尺寸
- 窗口大小调整时 UI 必须保持可用性
- 最小窗口尺寸限制必须合理

## Performance Requirements

### Application Performance
- 应用启动时间：冷启动 ≤ 3 秒，热启动 ≤ 1 秒
- UI 响应时间：用户交互到视觉反馈 ≤ 100ms
- 内存使用：基础内存占用 ≤ 100MB，峰值 ≤ 200MB
- 电池使用：后台运行时最小化电池消耗

### API Performance
- Rust 后端 API 响应时间：p50 ≤ 50ms，p95 ≤ 200ms
- 数据库查询优化：复杂查询 ≤ 100ms
- 并发处理：支持至少 100 个并发用户操作

### Frontend Performance
- 首屏渲染时间 ≤ 1 秒
- 组件重渲染最小化
- 懒加载策略用于大型数据集合
- 图片和资源优化

## Technology Stack Constraints

### Mandatory Technologies
- **Backend**: Rust (latest stable), Tauri core
- **Frontend**: React 18+, TypeScript 5+
- **UI Library**: Shadcn/ui components
- **State Management**: React Context
- **Testing**: Rust: built-in testing, React: Vitest + React Testing Library

### Prohibited Technologies
- 避免使用重型状态管理库（Redux、MobX）除非绝对必要
- 避免使用复杂的构建工具链
- 避免引入不必要的 Rust crates
- 禁止使用已弃用的 React 模式

### Architecture Constraints
- 保持简单的单体架构，避免微服务过度工程化
- 数据层抽象保持在必要的最低水平
- 优先使用 Tauri 内置功能而非外部依赖
- 遵循 YAGNI（You Aren't Gonna Need It）原则
- 遵循 Let it Crash 原则，不要进行复杂的错误处理与退让策略

## Development Workflow

### Quality Gates
- 所有代码必须通过 linting 和格式化检查
- 测试覆盖率必须满足最低要求
- 性能基准测试必须通过
- 用户场景测试必须验证

### Review Process
- 每个 PR 必须经过代码审查
- 性能影响评估是强制性的
- 用户体验一致性检查必须进行
- 文档更新必须与代码变更同步

### Deployment Standards
- 自动化测试必须全部通过
- 性能基准测试必须验证
- 用户接受测试必须完成
- 回滚计划必须准备就绪

## Governance

本宪法优先于所有其他实践和约定。任何违反宪法原则的决策都必须经过正式的例外批准流程，并记录正当理由。

### Amendment Procedure
- 宪法修正需要项目维护者的正式批准
- 重大变更需要影响分析和迁移计划
- 所有修正必须记录版本变更和影响评估
- 技术决策必须与宪法原则保持一致

### Compliance Review
- 所有 PR 和代码审查必须验证宪法合规性
- 定期进行架构审查以确保原则遵循
- 复杂性增加必须经过正当性论证
- 使用 `.specify/templates/` 中的模板确保一致性

### Version Control
- 宪法版本遵循语义版本控制
- 重大变更递增主版本号
- 新增原则或重大修改递增次版本号
- 澄清和微小修改递增补丁版本号

**Version**: 1.1.0 | **Ratified**: 2025-01-27 | **Last Amended**: 2025-01-27
