# Phase 2.1: Terminal 基础设施实现计划

**创建日期**: 2026-01-10
**更新日期**: 2026-01-10
**状态**: 规划中
**阶段**: Phase 2.1 - 基础设施（最小可用版本）
**目标**: 实现类似 VSCode 的 Terminal 集成，提供基础的命令执行能力

---

## 一、背景与目标

### 1.1 需求背景

为 Phase 2.2 的 Agent 集成做准备，先实现最基础的 Terminal 功能。

**核心需求**：
1. **Terminal UI 集成**：在 EditorCanvas 底部添加可折叠的 Terminal 面板
2. **基础命令执行**：Terminal 工作在 .elf 文件解压目录，支持执行基础命令
3. **特殊命令支持**：`cd ~` 回到 .elf 工作目录

### 1.2 Phase 2.1 范围（最小实现）

**本阶段实现**：
- ✅ Terminal UI 组件（EditorCanvas 底部可折叠面板）
- ✅ Terminal PTY 会话管理（使用现有实现）
- ✅ 固定工作目录为 .elf 解压目录
- ✅ `cd ~` 特殊命令

**不包含**（留待 Phase 2.2 或更晚）：
- ❌ Directory Block 关联
- ❌ 外部项目目录支持
- ❌ 文件导出同步机制
- ❌ 多 Terminal 标签

---

## 二、架构设计

### 2.1 Terminal 工作目录（固定模式）

**Phase 2.1 采用最简设计**：Terminal 固定工作在 .elf 文件解压目录。

```
.elf 文件解压目录结构:
~/.elfiee/temp/{file_id}/
├── _eventstore.db       # Event 数据库
├── _snapshot            # Markdown 缓存
├── _blocks_hash         # Hash 缓存
└── _blocks_relation     # Relation 缓存

Terminal cwd = ~/.elfiee/temp/{file_id}/
```

**说明**：
- ✅ 用户在此目录可以执行基础命令（ls, cd, echo 等）
- ✅ 可以安装并执行外部工具（claude, npm, python 等）
- ⚠️ 注意：Block 内容存储在数据库中，不是物理文件
- ⚠️ 此目录不包含项目配置（Cargo.toml、package.json 等）

### 2.2 UI 架构（VSCode 风格）

```
┌─────────────────────────────────────┐
│  EditorCanvas (Markdown/Code Editor)│
│                                     │
│  [Content Area]                     │
│                                     │
├─────────────────────────────────────┤
│  [Terminal Toggle Button] ▼         │  ← 可折叠的分隔条
├─────────────────────────────────────┤
│  Terminal Panel (可折叠)             │
│  ┌─────────────────────────────────┐│
│  │ bash $ _                        ││  ← xterm.js 实例
│  │                                 ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**交互行为**：
1. 点击底部按钮，Terminal 面板向上展开（类似 VSCode `Ctrl+`）
2. 可拖动分隔条调整高度
3. 再次点击按钮或按 `Esc` 折叠 Terminal
4. Terminal 会话保持活跃（折叠不会关闭 PTY）

### 2.3 `cd ~` 特殊命令

**实现方式**：在 PTY 启动时注入 shell 初始化脚本。

```rust
// 获取 .elf 工作目录
fn get_elf_work_directory(file_id: &str) -> PathBuf {
    let home = dirs::home_dir().unwrap();
    home.join(".elfiee").join("temp").join(file_id)
}

// 生成 shell 初始化脚本
fn generate_shell_init(work_dir: &PathBuf, shell: &str) -> String {
    let work_dir_str = work_dir.to_string_lossy();

    match shell {
        "bash" | "zsh" => format!(
            r#"
export ELF_WORK_DIR="{work_dir}"

# cd ~ 回到 .elf 工作目录
function cd() {{
    if [ "$1" = "~" ]; then
        builtin cd "$ELF_WORK_DIR"
    else
        builtin cd "$@"
    fi
}}

clear
echo "📦 Elfiee Terminal"
echo "Working directory: $ELF_WORK_DIR"
echo "💡 Use 'cd ~' to return here"
"#,
            work_dir = work_dir_str
        ),

        "powershell" => format!(
            r#"
$env:ELF_WORK_DIR = "{work_dir}"

function Set-Location {{
    param([string]$Path)
    if ($Path -eq "~") {{
        Microsoft.PowerShell.Management\Set-Location $env:ELF_WORK_DIR
    }} else {{
        Microsoft.PowerShell.Management\Set-Location $Path
    }}
}}

Clear-Host
Write-Host "📦 Elfiee Terminal" -ForegroundColor Cyan
Write-Host "Working directory: $env:ELF_WORK_DIR"
"#,
            work_dir = work_dir_str
        ),

        _ => String::new()
    }
}
```

---

## 三、开发任务清单

### Phase 2.1.1: 后端 - Shell 初始化脚本

**估时**: 0.5 天

#### 任务 1.1: 实现工作目录获取

新增文件：`src-tauri/src/extensions/terminal/utils.rs`

```rust
use std::path::PathBuf;

/// 获取 .elf 文件的工作目录
pub fn get_elf_work_directory(file_id: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let work_dir = home.join(".elfiee").join("temp").join(file_id);

    // 确保目录存在
    std::fs::create_dir_all(&work_dir)
        .map_err(|e| format!("Failed to create work directory: {}", e))?;

    Ok(work_dir)
}
```

**测试用例**：
- [ ] 正确返回 ~/.elfiee/temp/{file_id}
- [ ] 自动创建不存在的目录

#### 任务 1.2: 注入 Shell 初始化脚本

修改 `src-tauri/src/extensions/terminal/pty.rs`：

```rust
#[tauri::command]
#[specta]
pub async fn async_init_terminal(
    app_handle: AppHandle,
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    payload: TerminalInitPayload,
) -> Result<(), String> {
    // ... 现有 PTY 初始化代码 ...

    // 获取 .elf 工作目录
    let work_dir = get_elf_work_directory(&payload.file_id)?;

    // 设置 cwd
    cmd_builder.cwd(&work_dir);

    // 启动 shell
    let child = pair.slave.spawn_command(cmd_builder)?;
    drop(pair.slave);

    // 获取 shell 类型
    let shell = if cfg!(target_os = "windows") {
        "powershell"
    } else {
        "bash"
    };

    // 注入初始化脚本
    let init_script = generate_shell_init(&work_dir, shell)?;

    // 等待 shell 启动
    tokio::time::sleep(Duration::from_millis(100)).await;

    // 写入初始化脚本
    let mut writer = pair.master.take_writer()?;
    write!(writer, "{}\n", init_script)?;

    // ... 剩余代码（创建 reader 线程等）...
}
```

新增函数：

```rust
fn generate_shell_init(work_dir: &PathBuf, shell: &str) -> Result<String, String> {
    let work_dir_str = work_dir.to_string_lossy();

    match shell {
        "bash" | "zsh" => Ok(format!(
            r#"
export ELF_WORK_DIR="{work_dir}"

function cd() {{
    if [ "$1" = "~" ]; then
        builtin cd "$ELF_WORK_DIR"
    else
        builtin cd "$@"
    fi
}}

clear
echo "📦 Elfiee Terminal"
echo "Working directory: $ELF_WORK_DIR"
echo "💡 Use 'cd ~' to return here"
"#,
            work_dir = work_dir_str
        )),

        "powershell" => Ok(format!(
            r#"
$env:ELF_WORK_DIR = "{work_dir}"

function Set-Location {{
    param([string]$Path)
    if ($Path -eq "~") {{
        Microsoft.PowerShell.Management\Set-Location $env:ELF_WORK_DIR
    }} else {{
        Microsoft.PowerShell.Management\Set-Location $Path
    }}
}}

Clear-Host
Write-Host "📦 Elfiee Terminal" -ForegroundColor Cyan
Write-Host "Working directory: $env:ELF_WORK_DIR"
"#,
            work_dir = work_dir_str
        )),

        _ => Err(format!("Unsupported shell: {}", shell))
    }
}
```

**测试用例**：
- [ ] Terminal 启动在正确的工作目录
- [ ] `cd ~` 跳转到 .elf 工作目录
- [ ] 欢迎消息正确显示

---

### Phase 2.1.2: 前端 - Terminal UI 组件

**估时**: 2 天

#### 任务 2.1: 确认 xterm.js 依赖

检查 `package.json` 中已有的依赖：
```json
{
  "@xterm/addon-fit": "^0.10.0",
  "@xterm/addon-web-links": "^0.11.0",
  "@xterm/xterm": "^5.5.0"
}
```

✅ 依赖已安装，无需额外操作。

#### 任务 2.2: 创建 TerminalPanel 组件（简化版）

新增文件：`src/components/terminal/TerminalPanel.tsx`

**核心功能**：
- xterm.js 实例管理
- PTY 输入/输出处理
- 自动调整大小
- 最大化/关闭按钮

```typescript
import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { listen } from '@tauri-apps/api/event'
import { TauriClient } from '@/lib/tauri-client'
import { useAppStore } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { X, Minimize2, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  fileId: string
  onClose: () => void
}

export function TerminalPanel({ fileId, onClose }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [blockId] = useState(() => `terminal-${Date.now()}`)  // 临时 ID
  const currentEditorId = useAppStore((state) => state.currentEditorId)

  useEffect(() => {
    if (!terminalRef.current || !currentEditorId) return

    // 创建 xterm 实例
    const term = new Terminal({
      fontFamily: 'monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
      scrollback: 1000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // 初始化 PTY
    initTerminal(term)

    // 监听 PTY 输出
    const unlisten = listen<{ data: string; block_id: string }>(
      'pty-out',
      (event) => {
        if (event.payload.block_id === blockId) {
          const decoded = atob(event.payload.data)
          term.write(decoded)
        }
      }
    )

    // 监听用户输入
    const disposable = term.onData((data) => {
      TauriClient.writeToPty({
        blockId,
        fileId,
        editorId: currentEditorId,
        data,
      })
    })

    // 窗口大小变化
    const handleResize = () => {
      fitAddon.fit()
      TauriClient.resizePty({
        blockId,
        fileId,
        editorId: currentEditorId,
        cols: term.cols,
        rows: term.rows,
      })
    }
    window.addEventListener('resize', handleResize)

    // 清理
    return () => {
      disposable.dispose()
      unlisten.then((fn) => fn())
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [blockId, fileId, currentEditorId])

  const initTerminal = async (term: Terminal) => {
    try {
      await TauriClient.asyncInitTerminal({
        blockId,
        fileId,
        editorId: currentEditorId!,
        cols: term.cols,
        rows: term.rows,
      })
    } catch (error) {
      console.error('Failed to init terminal:', error)
      toast.error('Failed to initialize terminal')
    }
  }

  const handleToggleMaximize = () => {
    setIsMaximized(!isMaximized)
    setTimeout(() => fitAddonRef.current?.fit(), 300)
  }

  const handleClose = async () => {
    try {
      await TauriClient.closeTerminalSession({
        blockId,
        fileId,
        editorId: currentEditorId!,
      })
    } catch (error) {
      console.error('Failed to close terminal:', error)
    }
    onClose()
  }

  return (
    <div className={`flex flex-col border-t border-border bg-[#1e1e1e] ${isMaximized ? 'h-[70vh]' : 'h-[300px]'}`}>
      <div className="flex items-center justify-between border-b bg-[#252526] px-4 py-2">
        <span className="text-sm text-[#cccccc]">Terminal</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={handleToggleMaximize}>
            {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 p-2" />
    </div>
  )
}
```

#### 任务 2.3: 集成到 EditorCanvas（简化版）

修改 `src/components/editor/EditorCanvas.tsx`，在底部添加 Terminal 按钮和面板：

```typescript
import { useState } from 'react'
import { Terminal as TerminalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TerminalPanel } from '@/components/terminal/TerminalPanel'
import { useAppStore } from '@/lib/app-store'

export const EditorCanvas = () => {
  const [showTerminal, setShowTerminal] = useState(false)
  const currentFileId = useAppStore((state) => state.currentFileId)

  // ... 现有代码 ...

  return (
    <div className="flex h-full flex-col">
      {/* 原有编辑器内容 */}
      <ScrollArea className="flex-1">
        {/* ... 现有 renderEditor() 代码 ... */}
      </ScrollArea>

      {/* Terminal Toggle Button */}
      {!showTerminal && (
        <div className="flex justify-center border-t p-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowTerminal(true)}
            disabled={!currentFileId}
          >
            <TerminalIcon className="mr-2 h-3 w-3" />
            Open Terminal
          </Button>
        </div>
      )}

      {/* Terminal Panel */}
      {showTerminal && currentFileId && (
        <TerminalPanel
          fileId={currentFileId}
          onClose={() => setShowTerminal(false)}
        />
      )}
    </div>
  )
}
```

**测试用例**：
- [ ] 点击按钮打开 Terminal
- [ ] Terminal 显示欢迎消息
- [ ] 可以执行基础命令（ls, pwd, cd）
- [ ] `cd ~` 跳转回 .elf 工作目录
- [ ] 最大化/关闭按钮正常工作

---

### Phase 2.1.3: 验收测试

**估时**: 0.5 天

#### 验收标准

**基础功能**：
1. ✅ 打开 .elf 文件后可以打开 Terminal
2. ✅ Terminal 显示欢迎消息和工作目录路径
3. ✅ 可以执行基础命令（ls, pwd, echo）
4. ✅ `cd ~` 回到 .elf 工作目录

**UI 交互**：
5. ✅ 最大化/最小化功能正常
6. ✅ 关闭按钮可以关闭 Terminal
7. ✅ 窗口大小变化时 Terminal 自动调整

**已知限制**（Phase 2.1）：
- ⚠️ Block 内容在数据库中，Terminal 无法直接访问
- ⚠️ 不支持 Directory Block 关联
- ⚠️ 不支持文件监听和自动同步

---

## 四、实现顺序建议（3 天）

**Day 1**：后端实现
- 任务 1.1: 实现 `get_elf_work_directory`
- 任务 1.2: 修改 `async_init_terminal`，注入初始化脚本

**Day 2**：前端实现
- 任务 2.2: 创建 TerminalPanel 组件
- 任务 2.3: 集成到 EditorCanvas

**Day 3**：测试与调试
- 验收测试
- 跨平台测试（Windows/Linux/macOS）
- Bug 修复

---

## 五、关键设计说明

### 5.1 为什么固定 .elf 目录？

**简化原则**：Phase 2.1 只实现最基础功能，避免过度设计。

- ✅ 满足基础命令执行需求
- ✅ 实现简单，无需复杂配置
- ✅ 为 Phase 2.2 的 Agent 集成打好基础

### 5.2 Block 内容访问限制

**现状**：
- Block 内容存储在 `_eventstore.db`（SQLite）
- Terminal 无法直接访问这些内容（没有物理文件）

**影响**：
- ❌ 无法执行 `python block-xyz/script.py`
- ❌ 无法运行需要项目配置的工具（cargo, npm）

**Phase 2.2 解决方案**：
- Agent 通过 API 读取 Block 内容
- Agent 可以将内容导出为临时文件供 Terminal 使用

### 5.3 为什么不持久化 Terminal？

Phase 2.1 的 Terminal 是临时会话：
- 不创建 Terminal Block（不生成 Event）
- 关闭后会话结束，不保留历史
- 类似 VSCode 的 Integrated Terminal 行为

---

## 六、注意事项

### 6.1 跨平台 Shell 差异

- Windows: PowerShell
- Linux/macOS: Bash

初始化脚本需要分别实现。

### 6.2 PTY 资源管理

确保 Terminal 关闭时正确释放 PTY 资源：
- 调用 `close_terminal_session`
- 发送 `shutdown_tx` 信号
- Drop writer/master

### 6.3 工作目录清理

.elf 解压目录在文件关闭时会被清理。用户需要知道这一点。

---

**文档作者**: Elfiee Dev Team
**最后更新**: 2026-01-10
