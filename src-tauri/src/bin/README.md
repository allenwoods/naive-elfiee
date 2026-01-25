# Elfiee CLI

`.elf` 文件操作的命令行接口工具。

## 概述

Elfiee CLI 提供终端访问所有 Elfiee API 的能力，允许用户和 AI 代理在无需 GUI 应用的情况下创建、读取和操作 `.elf` 文件。

### 核心概念

| 概念 | 描述 |
|------|------|
| **Block（块）** | 基本内容单元（markdown、code、directory 等） |
| **Editor（编辑者）** | 执行操作的用户或代理 |
| **Capability（能力）** | 可执行的操作（如 `markdown.write`、`core.create`） |
| **Event（事件）** | 变更的不可变记录（事件溯源） |

## 安装

### 方式一：直接构建运行（推荐用于开发）

```bash
cd src-tauri
cargo build --bin elfiee

# 使用绝对路径运行
./target/debug/elfiee --help          # Unix/Linux/macOS
.\target\debug\elfiee.exe --help      # Windows
```

### 方式二：全局安装

```bash
cd src-tauri
cargo install --path . --bin elfiee

# 现在可以全局使用
elfiee --help
```

## 快速开始

```bash
# 1. 创建新的 .elf 文件
elfiee file create ./my-notes.elf

# 2. 创建根块
elfiee exec ./my-notes.elf "" core.create '{"name":"root","block_type":"directory"}'

# 3. 列出所有块
elfiee block list ./my-notes.elf

# 4. 查看文件信息
elfiee file info ./my-notes.elf
```

## 命令参考

### 全局选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `-f, --format <FORMAT>` | 输出格式：`json`、`pretty`、`plain` | `pretty` |
| `-h, --help` | 显示帮助信息 | - |
| `-V, --version` | 显示版本信息 | - |

### File 命令

管理 `.elf` 文件。

```bash
elfiee file <子命令>
```

| 子命令 | 描述 | 示例 |
|--------|------|------|
| `create <PATH>` | 创建新的 .elf 文件 | `elfiee file create ./new.elf` |
| `open <PATH>` | 打开并显示文件摘要 | `elfiee file open ./existing.elf` |
| `info <PATH>` | 显示详细文件信息 | `elfiee file info ./file.elf` |

**示例：**

```bash
# 创建新文件
elfiee file create ./project.elf

# 打开并查看摘要
elfiee file open ./project.elf

# 获取详细信息（块、编辑者、事件）
elfiee file info ./project.elf
```

### Block 命令

查询文件中的块。

```bash
elfiee block <子命令>
```

| 子命令 | 描述 | 示例 |
|--------|------|------|
| `list <PATH>` | 列出所有块 | `elfiee block list ./file.elf` |
| `get <PATH> <BLOCK_ID>` | 获取块详情 | `elfiee block get ./file.elf abc-123` |

**示例：**

```bash
# 列出所有块
elfiee block list ./project.elf

# 获取特定块的详情
elfiee block get ./project.elf 550e8400-e29b-41d4-a716-446655440000
```

### Exec 命令

在块上执行能力。这是修改 `.elf` 文件的主要方式。

```bash
elfiee exec <PATH> <BLOCK_ID> <CAPABILITY> [PAYLOAD]
```

| 参数 | 描述 |
|------|------|
| `PATH` | .elf 文件的路径 |
| `BLOCK_ID` | 目标块 ID（根级操作使用空字符串 `""`） |
| `CAPABILITY` | 能力 ID（如 `core.create`、`markdown.write`） |
| `PAYLOAD` | JSON 载荷（可选，默认为 `{}`） |

**示例：**

```bash
# 创建新块（根操作使用空 block_id）
elfiee exec ./file.elf "" core.create '{"name":"docs","block_type":"directory"}'

# 写入 markdown 内容
elfiee exec ./file.elf abc-123 markdown.write '{"content":"# Hello World\n\n这是我的笔记。"}'

# 链接两个块
elfiee exec ./file.elf parent-id core.link '{"child_id":"child-id","relation":"contains"}'

# 授予编辑者能力
elfiee exec ./file.elf block-id core.grant '{"editor_id":"alice","cap_id":"markdown.write"}'
```

### Editor 命令

管理编辑者（用户/代理）。

```bash
elfiee editor <子命令>
```

| 子命令 | 描述 | 示例 |
|--------|------|------|
| `list <PATH>` | 列出所有编辑者 | `elfiee editor list ./file.elf` |

**示例：**

```bash
# 列出文件中的所有编辑者
elfiee editor list ./project.elf
```

### Grant 命令

查询和检查权限。

```bash
elfiee grant <子命令>
```

| 子命令 | 描述 |
|--------|------|
| `list <PATH>` | 列出所有能力授权 |
| `check <PATH> <EDITOR_ID> <BLOCK_ID> <CAP_ID>` | 检查编辑者是否有权限 |

**示例：**

```bash
# 列出所有授权
elfiee grant list ./project.elf

# 检查 "alice" 是否可以在特定块上写入 markdown
elfiee grant check ./project.elf alice block-123 markdown.write
```

### Event 命令

查询事件历史（审计日志）。

```bash
elfiee event <子命令>
```

| 子命令 | 描述 |
|--------|------|
| `list <PATH>` | 列出所有事件 |
| `list <PATH> --limit N` | 列出最近 N 个事件 |

**示例：**

```bash
# 列出所有事件
elfiee event list ./project.elf

# 列出最近 10 个事件
elfiee event list ./project.elf --limit 10
```

### PTY 命令

终端/PTY 操作。**注意：这些命令需要 GUI 应用，在 CLI 模式下不支持。**

```bash
elfiee pty <子命令>
```

| 子命令 | 描述 |
|--------|------|
| `init` | 初始化 PTY 会话 |
| `write` | 写入 PTY |
| `resize` | 调整 PTY 大小 |
| `close` | 关闭 PTY 会话 |

## 能力参考

### 核心能力

| 能力 | 描述 | 载荷 |
|------|------|------|
| `core.create` | 创建新块 | `{"name":"<名称>","block_type":"<类型>"}` |
| `core.link` | 链接块 | `{"child_id":"<id>","relation":"<关系>"}` |
| `core.unlink` | 移除链接 | `{"child_id":"<id>","relation":"<关系>"}` |
| `core.grant` | 授予编辑者能力 | `{"editor_id":"<id>","cap_id":"<能力>"}` |
| `core.revoke` | 撤销编辑者能力 | `{"editor_id":"<id>","cap_id":"<能力>"}` |

### 扩展能力

| 能力 | 目标块类型 | 描述 | 载荷 |
|------|------------|------|------|
| `markdown.write` | markdown | 写入 markdown 内容 | `{"content":"<md>"}` |
| `markdown.read` | markdown | 读取 markdown 内容 | `{}` |
| `directory.create` | directory | 创建目录块 | `{"name":"<名称>"}` |
| `directory.delete` | directory | 删除目录块 | `{}` |
| `code.write` | code | 写入代码内容 | `{"content":"<代码>","language":"<语言>"}` |
| `code.read` | code | 读取代码内容 | `{}` |

## 载荷格式

所有载荷都是 JSON 对象。以下是常见模式：

### 创建块

```json
{
  "name": "my-document",
  "block_type": "markdown"
}
```

### 写入内容

```json
{
  "content": "# 标题\n\n段落文本。"
}
```

### 链接块

```json
{
  "child_id": "550e8400-e29b-41d4-a716-446655440000",
  "relation": "contains"
}
```

### 授予权限

```json
{
  "editor_id": "alice",
  "cap_id": "markdown.write"
}
```

## 输出格式

### Pretty（默认）

带缩进的人类可读 JSON：

```bash
elfiee block list ./file.elf
# 或
elfiee --format pretty block list ./file.elf
```

```json
{
  "path": "./file.elf",
  "count": 2,
  "blocks": [
    {
      "block_id": "abc-123",
      "name": "root",
      "block_type": "directory"
    }
  ]
}
```

### JSON（紧凑）

单行 JSON，适合管道传输给其他工具：

```bash
elfiee --format json block list ./file.elf
```

```json
{"path":"./file.elf","count":2,"blocks":[{"block_id":"abc-123","name":"root","block_type":"directory"}]}
```

### Plain（纯文本）

简单文本输出：

```bash
elfiee --format plain block list ./file.elf
```

```
path: ./file.elf
count: 2
blocks:
  block_id: abc-123
  name: root
  block_type: directory
```

## 与 AI/自动化集成

CLI 专为 AI 代理和自动化脚本设计。主要特性：

1. **结构化 JSON 输出**：使用 `--format json` 获取机器可解析的输出
2. **无交互式提示**：所有操作都是非交互式的
3. **确定性**：相同的输入产生相同的输出
4. **退出码**：成功返回 0，错误返回非零值

### 示例：AI 代理工作流

```bash
# 创建文件
elfiee file create ./agent-workspace.elf

# 创建根结构
ROOT_ID=$(elfiee --format json exec ./agent-workspace.elf "" core.create '{"name":"workspace","block_type":"directory"}' | jq -r '.events[0].entity')

# 添加 markdown 文档
DOC_ID=$(elfiee --format json exec ./agent-workspace.elf "" core.create '{"name":"notes","block_type":"markdown"}' | jq -r '.events[0].entity')

# 将文档链接到根
elfiee exec ./agent-workspace.elf "$ROOT_ID" core.link "{\"child_id\":\"$DOC_ID\",\"relation\":\"contains\"}"

# 写入内容
elfiee exec ./agent-workspace.elf "$DOC_ID" markdown.write '{"content":"# 代理笔记\n\n由自动化生成。"}'
```

## 错误处理

错误会输出到 stderr，进程以非零状态退出：

```bash
# 文件未找到
elfiee file info ./nonexistent.elf
# Error: File not found: ./nonexistent.elf

# 无效的 JSON 载荷
elfiee exec ./file.elf "" core.create 'not-json'
# Error: Invalid JSON payload

# 块未找到
elfiee block get ./file.elf invalid-id
# Error: Block not found: invalid-id
```

## 与 GUI 应用的关系

CLI 和 GUI 共享相同的核心库（`elfiee_lib`）：

```
elfiee-app (GUI)  ─┐
                   ├──> elfiee_lib (核心库)
elfiee (CLI)      ─┘
```

- **GUI (`elfiee-app`)**：使用 Tauri 的完整图形界面
- **CLI (`elfiee`)**：用于自动化和 AI 代理的终端接口

两者可以操作相同的 `.elf` 文件。CLI 所做的更改在 GUI 中可见，反之亦然。

## 文件说明

| 文件 | 描述 |
|------|------|
| `elfiee.rs` | CLI 主要实现 |
| `README.md` | 本文档 |

## 相关文档

- [SKILL.md](../../../docs/skills/elfiee-dev/SKILL.md) - AI 代理的系统级技能文档
- [CLAUDE.md](../../../CLAUDE.md) - 项目概述和开发指南
- [elfiee-ext-gen](../../../elfiee-ext-gen/README.md) - 扩展生成器工具
