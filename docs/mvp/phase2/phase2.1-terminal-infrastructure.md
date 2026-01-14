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
2. **基础命令执行**：Terminal 使用系统级 PTY（bash/PowerShell），支持任意目录切换
3. **特殊命令支持**：`cd ~` 回到 .elf 工作目录

### 1.2 Terminal 工作模式设计

**模式概览**：

Terminal 根据当前工作目录（cwd）有两种行为模式：

**模式 1：在 .elf 解压目录下**（未来功能）
```bash
# 打开 Terminal，初始 cwd 在临时目录（/tmp/random-xxx/）
ls block-xxx/           # 可以看到 block 目录
cd block-abc/workspace/ # 未来：自动同步的工作区
ls                      # 未来：看到从 JSON 同步的物理文件
python script.py        # 未来：可以执行 Block 中的代码
```

**特性**（未来实现）：
- 自动在 `block-xxx/workspace/` 创建工作区
- 根据 Block JSON 内容生成物理文件
- 支持实时同步（文件修改 → Block 更新）

**模式 2：在其他目录下**（Phase 2.1 实现）
```bash
cd /path/to/project/    # 切换到任意外部目录
ls                      # 正常显示系统文件
npm install             # 正常执行命令
cd ~                    # 特殊命令：回到 .elf 解压目录
```

**特性**（本阶段实现）：
- 标准 PTY 行为（bash/PowerShell）
- 支持任意目录切换
- 正常输入/输出

### 1.3 Phase 2.1 范围（最小实现）

**本阶段专注于"模式 2"**：

**实现内容**：
- ✅ Terminal UI 组件（EditorCanvas 底部可折叠面板）
- ✅ Terminal PTY 会话管理（使用现有实现）
- ✅ 初始工作目录为 .elf 解压目录
- ✅ `cd ~` 特殊命令（回到 .elf 目录）
- ✅ 支持切换到任意外部目录
- ✅ 标准命令输入/输出

**不包含**（留待后续阶段）：
- ❌ workspace 自动同步（模式 1 的核心功能）
- ❌ JSON → 物理文件的自动生成
- ❌ 文件修改监听和反向同步
- ❌ 多 Terminal 标签

**为什么这样分阶段**：
1. **降低风险**：先实现基础 Terminal，确保 UI 和 PTY 集成稳定
2. **渐进式增强**：workspace 同步涉及复杂的文件监听和冲突处理
3. **Agent 依赖**：workspace 同步需要配合 Phase 2.2 Agent 设计

---

## 二、架构设计

### 2.1 Terminal 工作目录管理

**Phase 2.1 设计**：Terminal 初始工作在 .elf 文件解压目录，支持任意切换。

**.elf 文件解压目录结构**：

打开 .elf 文件时，系统会自动创建临时目录（`tempfile::TempDir`）：
```
/tmp/random-xxxxx/       # 系统临时目录（Linux/macOS）
或
C:\Users\...\Temp\...    # 系统临时目录（Windows）

目录内容：
├── events.db            # Event 数据库
├── block-{uuid}/        # Block 物理目录（Phase 2.1 主要是空的）
│   └── workspace/       # Phase 2.2 会添加
└── ...                  # 其他文件
```

**获取临时目录路径**：

从现有代码（`src-tauri/src/elf/archive.rs`）：
```rust
// ElfArchive 已经提供了临时目录访问
pub struct ElfArchive {
    temp_dir: TempDir,  // 系统自动分配的临时目录
    db_path: PathBuf,
}

// 获取临时目录路径
pub fn temp_path(&self) -> &Path {
    self.temp_dir.path()
}
```

**Terminal 行为**：
```bash
# 打开 Terminal，初始 cwd 在临时目录
pwd
# 输出: /tmp/random-xxxxx/ (或 Windows 临时目录)

# 可以切换到任意目录
cd /path/to/my/project/
npm install              # 正常执行

# 特殊命令：回到 .elf 临时目录
cd ~
pwd
# 输出: /tmp/random-xxxxx/
```

**核心特性**：
- ✅ 初始 cwd 在 .elf 解压临时目录（系统自动分配）
- ✅ 支持 `cd` 到任意外部目录
- ✅ `cd ~` 回到 .elf 临时目录（通过 shell 初始化脚本实现）
- ✅ 标准 PTY 行为，无特殊限制

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
│  │ bash $ cd /path/to/project      ││  ← xterm.js 实例
│  │ bash $ npm install              ││
│  │ bash $ cd ~                     ││  ← 回到 .elf 目录
│  │ bash $ _                        ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**交互行为**：
1. 点击底部按钮，Terminal 面板向上展开（类似 VSCode `Ctrl+`）
2. 可拖动分隔条调整高度
3. 再次点击按钮或按 `Esc` 折叠 Terminal
4. Terminal 会话保持活跃（折叠不会关闭 PTY）
5. 支持任意目录切换，无限制

### 2.3 `cd ~` 特殊命令实现

**实现方式**：在 PTY 启动时注入 shell 初始化脚本。

**获取临时目录路径**：

从 `AppState` 中获取 `ElfArchive`，然后使用 `temp_path()` 方法：
```rust
// 从 AppState 获取文件的临时目录
fn get_elf_temp_directory(state: &AppState, file_id: &str) -> Result<PathBuf, String> {
    let file_info = state
        .files
        .get(file_id)
        .ok_or_else(|| format!("File '{}' not found", file_id))?;

    Ok(file_info.archive.temp_path().to_path_buf())
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

#### 任务 1.1: 实现临时目录获取

**无需新增代码**，使用现有的 `ElfArchive::temp_path()` 方法。

从 `AppState` 中获取临时目录：
```rust
// 在 PTY 初始化时获取临时目录
use crate::state::AppState;

fn get_elf_temp_directory(state: &AppState, file_id: &str) -> Result<PathBuf, String> {
    let file_info = state
        .files
        .get(file_id)
        .ok_or_else(|| format!("File '{}' not found", file_id))?;

    // 使用现有的 temp_path() 方法
    Ok(file_info.archive.temp_path().to_path_buf())
}
```

**说明**：
- `ElfArchive` 已经管理了临时目录（`TempDir`）
- 临时目录在文件打开时自动创建
- 临时目录在文件关闭时自动清理（`TempDir` Drop）

**测试用例**：
- [ ] 正确返回系统临时目录路径
- [ ] 路径有效且可访问

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

    // 获取 .elf 临时工作目录（使用现有的 temp_path）
    let file_info = app_state
        .files
        .get(&payload.file_id)
        .ok_or_else(|| format!("File '{}' not found", payload.file_id))?;

    let temp_dir = file_info.archive.temp_path();

    // 设置 cwd
    cmd_builder.cwd(temp_dir);

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
    let init_script = generate_shell_init(temp_dir, shell)?;

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

### 5.1 为什么 Phase 2.1 不实现 workspace 同步？

**简化原则**：Phase 2.1 只实现最基础功能，避免过度设计。

**原因**：
- ✅ **降低复杂度**：workspace 同步涉及文件监听、冲突检测、双向同步等复杂逻辑
- ✅ **渐进式增强**：先验证基础 Terminal UI 和 PTY 集成是否稳定
- ✅ **Agent 依赖**：workspace 同步需要配合 Phase 2.2 Agent 的能力设计

**Phase 2.1 提供的基础**：
- Terminal UI 组件和 PTY 管理
- `cd ~` 特殊命令基础设施
- 为未来 workspace 同步预留扩展点

### 5.2 未来 workspace 同步设计（Phase 2.2+）

**目标**：在 .elf 解压目录下，自动同步 Block 内容到物理文件。

**核心机制**：

1. **workspace 目录结构**：
```
/tmp/random-xxxxx/          # 系统临时目录
├── events.db
├── block-abc/
│   └── workspace/           # 自动同步的工作区
│       ├── script.py        # 从 contents.text 生成
│       ├── README.md        # 从 contents.markdown 生成
│       └── ...
└── block-xyz/
    └── workspace/
        └── ...
```

2. **同步触发时机**：
   - **打开 Terminal 时**：自动生成所有 Block 的 workspace 文件
   - **Block 更新时**：实时同步 JSON → 物理文件
   - **文件修改时**（可选）：监听 workspace 文件变化 → 更新 Block

3. **实现策略**：
   - **JSON → 文件**：读取 `contents.text`/`markdown`，写入 workspace
   - **文件 → JSON**：监听文件变化，调用对应 extension 的 write capability
   - **冲突处理**：检测外部修改时间戳，提示用户选择保留哪个版本

4. **与 Agent 配合**：
   - Agent 可以直接操作 workspace 文件
   - Agent 执行命令后，workspace 修改自动同步回 Block
   - Agent 可以调用 `directory.export` 导出完整项目到外部目录

**技术挑战**：
- 文件监听性能（避免频繁触发）
- 冲突检测和解决 UI
- 大文件处理
- 跨平台文件系统差异

**预留扩展点**（Phase 2.1 已考虑）：
- `inject_block_dir` 函数已创建 `block-xxx/` 目录
- 可以在此基础上添加 `workspace/` 子目录
- PTY 已支持任意目录访问，workspace 同步不影响现有逻辑

### 5.3 Terminal Block 持久化设计

Terminal 是一个完整的 Block（block_type = "terminal"）：
- ✅ 创建 Terminal 时生成 Terminal Block（通过 `core.create` 事件）
- ✅ Terminal 内容（buffer 历史）保存到 `block.contents.saved_content`
- ✅ 关闭 Terminal 时自动调用 `terminal.save` 保存当前内容
- ✅ 支持恢复上次的 Terminal 会话（读取 `saved_content`）

**持久化时机**：
1. **手动保存**：用户主动触发 `terminal.save`
2. **自动保存**：关闭 Terminal 会话时自动保存
3. **定期保存**（可选）：每隔一段时间自动保存

**保存内容**：
```json
{
  "saved_content": "完整的 terminal buffer 内容",
  "saved_at": "2026-01-14T10:30:00Z",
  "cwd": "/path/to/last/directory"
}
```

**恢复会话**（未来增强）：
- 打开已有 Terminal Block 时，可显示上次保存的内容
- 可选择从上次的 cwd 继续工作

---

## 六、设计演进与决策记录

### 6.1 从"双模式"到"单一标准 Terminal"

**最初设计**（已废弃）：
- 提出了 Internal/External 双模式 Terminal
- Internal: 限制在 .elf 内部，特殊处理 Block 访问
- External: 工作在外部项目目录，运行编译/测试

**问题**：
1. 用户质疑："为什么要有双模式？用户如何感知当前模式？"
2. 实现复杂：需要模式切换、状态管理、配置 UI
3. 不符合"最简实现"原则

**新的理解**：
- Terminal 应该是**标准的 PTY**，没有特殊限制
- 支持任意目录切换（包括 .elf 内部和外部）
- 只需实现 `cd ~` 特殊命令即可

**最终决策**：
- ✅ Phase 2.1 实现标准 Terminal（初始 cwd 在 .elf 目录）
- ✅ 支持 `cd` 到任意外部目录
- ✅ `cd ~` 回到 .elf 目录
- ✅ workspace 同步留待 Phase 2.2+
- ✅ 降低实现复杂度：1周 → 3天

### 6.2 workspace 同步：从"立即实现"到"分阶段"

**初期想法**：
- 一开始考虑在 Phase 2.1 就实现 workspace 自动同步
- 让用户在 Terminal 中可以直接访问 Block 内容

**重新评估**：
- workspace 同步涉及复杂的文件监听、冲突检测、双向同步
- 需要配合 Agent 设计（Phase 2.2）才能发挥最大价值
- 先实现基础 Terminal，验证 UI 和 PTY 集成稳定性

**分阶段策略**：
- **Phase 2.1**：基础 Terminal（标准 PTY + `cd ~`）
- **Phase 2.2**：workspace 同步（自动生成物理文件）+ Agent 集成
- **Phase 2.3+**：高级功能（外部目录关联、文件监听、冲突解决）

### 6.3 Block 内容存储的真实情况

**核心事实**（通过代码审查）：

Elfiee 的 Block 内容**主要存储在 JSON** 中：

```rust
// directory.import: 读取外部文件 → 存储到 JSON
let content = fs::read_to_string(&file_info.absolute_path)?;
let contents = json!({
    "text": content,  // ← 内容在 JSON 中（_eventstore.db）
    "source": "linked"
});

// inject_block_dir: 创建空目录
fn inject_block_dir(temp_dir: &Path, block_id: &str, contents: &mut Value) {
    let block_dir = temp_dir.join(format!("block-{}", block_id));
    std::fs::create_dir_all(&block_dir)?;  // 创建目录，但 Phase 2.1 不写文件
    contents["_block_dir"] = json!(block_dir.to_string_lossy());
}
```

**Phase 2.1 状态**：
- Block 内容在 JSON（`events.db`）
- `block-xxx/` 目录存在但为空
- Terminal 可以 `cd` 进入，但看不到文件

**Phase 2.2 改进**：
- 在 `block-xxx/workspace/` 自动生成物理文件
- Terminal 可以直接操作这些文件
- 文件修改同步回 Block

### 6.4 设计权衡：简单 vs 完整

**用户明确要求**：
> "我认为不需要这么复杂的功能，先做最简单的实现吧"

**Phase 2.1 选择**：
| 功能 | Phase 2.1 | Phase 2.2+ |
|------|-----------|-----------|
| Terminal UI | ✅ 实现 | - |
| 标准 PTY 集成 | ✅ 实现 | - |
| 初始 cwd 在 .elf 目录 | ✅ 实现 | - |
| `cd ~` 命令 | ✅ 实现 | - |
| 任意目录切换 | ✅ 支持 | - |
| workspace 自动同步 | ❌ 不实现 | ✅ 自动生成物理文件 |
| Block 内容物理化 | ❌ 不实现 | ✅ JSON → workspace 文件 |
| 文件修改监听 | ❌ 不实现 | ✅ workspace → Block 同步 |
| 外部目录关联 | ❌ 不实现 | 🔮 Phase 3+ |

**优势**：
- ✅ 实现简单，3 天完成
- ✅ 降低风险，避免过度设计
- ✅ 标准 PTY 行为，无特殊限制
- ✅ 为 workspace 同步预留扩展点

**Phase 2.1 的实际能力**：
- ✅ 可以 `cd` 到任意外部项目目录并执行命令
- ✅ 可以运行独立的外部工具（claude、npm、python）
- ✅ `cd ~` 快速回到 .elf 目录

**Phase 2.1 的限制**（将在 Phase 2.2 解决）：
- ⚠️ Block 内容在 JSON，`block-xxx/` 目录为空
- ⚠️ 无法直接在 Terminal 中操作 Block 内容
- ⚠️ 需要手动 `cd` 到外部项目目录

### 6.5 未来演进路径

**Phase 2.2（workspace 同步 + Agent 集成）**：
- **workspace 自动同步**：
  - 打开 Terminal 时自动生成 `block-xxx/workspace/` 文件
  - 监听 Block 更新，实时同步到 workspace
  - 监听 workspace 文件变化，同步回 Block
- **Agent 集成**：
  - Agent 读取 Block JSON 内容
  - Agent 操作 workspace 文件
  - Agent 在 Terminal 中执行命令
  - Agent 调用 `directory.export` 导出完整项目

**Phase 2.3+（高级功能）**：
- 外部项目目录关联（Terminal 自动切换到关联目录）
- 冲突检测和解决 UI
- 多 Terminal 标签支持
- Terminal 历史持久化

---

## 七、注意事项

### 7.1 跨平台 Shell 差异

- Windows: PowerShell
- Linux/macOS: Bash

初始化脚本需要分别实现。

### 7.2 PTY 资源管理

确保 Terminal 关闭时正确释放 PTY 资源：
- 调用 `close_terminal_session`
- 发送 `shutdown_tx` 信号
- Drop writer/master

### 7.3 工作目录清理

.elf 解压目录在文件关闭时会被清理。用户需要知道这一点。

### 7.4 用户预期管理

**重要**：需要向用户明确说明 Terminal 的功能范围。

**Phase 2.1 Terminal 是标准的 PTY**：
- ✅ 执行任意 shell 命令（ls, cd, pwd, echo, grep, find 等）
- ✅ 运行外部工具（claude, npm, python, cargo 等）
- ✅ `cd` 到任意目录（.elf 内部或外部项目）
- ✅ `cd ~` 回到 .elf 解压目录
- ✅ 正常的输入/输出/错误流

**Phase 2.1 的限制**：
- ⚠️ Block 内容在 JSON 中，`block-xxx/` 目录为空
- ⚠️ 无法直接在 Terminal 中操作 Block 内容
- ⚠️ 需要手动 `cd` 到外部项目目录执行命令

**使用场景示例**：
```bash
# ✅ Phase 2.1 可以做的
cd /path/to/my/rust/project/
cargo build
cargo test
cd ~                            # 回到 .elf 目录

# ❌ Phase 2.1 无法做的（等 Phase 2.2）
cd block-abc/workspace/         # workspace 目录不存在
python script.py                # 文件在 JSON 中，不是物理文件
```

**Phase 2.2 改进**：
- workspace 自动同步，Block 内容自动生成物理文件
- 可以直接在 .elf 目录下操作 Block 内容
- Agent 自动化开发工作流

这些限制是 Phase 2.1 有意为之，不是 bug。

---

## 八、常见问题（FAQ）

### Q1: Phase 2.1 Terminal 可以做什么？

**A**: Phase 2.1 的 Terminal 是**标准的 PTY**，功能与系统终端一致。

**可以做的**：
```bash
# 在任意目录执行命令
cd /path/to/my/project/
npm install
npm test
cargo build

# 运行外部工具
claude chat
python script.py        # 外部项目的文件
git status

# 特殊命令
cd ~                    # 回到 .elf 解压目录
```

**限制**：
- ⚠️ `block-xxx/` 目录为空（Phase 2.2 会有 workspace）
- ⚠️ 无法直接操作 Block 内容（在 JSON 中）

### Q2: 为什么 `block-xxx/` 目录是空的？

**A**: Phase 2.1 **不实现** workspace 同步，Block 内容存储在 JSON 中。

**当前状态**：
```bash
# Terminal 初始在系统临时目录
pwd                     # 输出: /tmp/random-xxxxx/
ls block-abc/           # 目录存在
cd block-abc/
ls                      # 空的（内容在 events.db）
```

**Phase 2.2 会改进**：
```bash
cd block-abc/workspace/
ls                      # 自动同步的物理文件
python script.py        # 可以执行
```

### Q3: 如何在 Terminal 中操作我的代码？

**A**: Phase 2.1 的推荐做法是 `cd` 到外部项目目录。

**方案 1：外部项目目录**（推荐）
```bash
cd /path/to/my/rust/project/
cargo build
cargo test
cd ~                    # 回到 .elf 目录
```

**方案 2：等待 Phase 2.2**
- workspace 自动同步
- 可以直接在 .elf 目录下操作 Block 内容

### Q4: `cd ~` 命令有什么用？

**A**: `cd ~` 回到 .elf 文件的解压目录（快捷方式）。

**使用场景**：
```bash
# 切换到外部项目
cd /path/to/my/project/
npm install

# 快速回到 .elf 临时目录
cd ~
pwd
# 输出: /tmp/random-xxxxx/

# 查看 Block 目录列表
ls block-*/
```

### Q5: Terminal 会持久化命令历史吗？

**A**: Phase 2.1 **不持久化**，Terminal 是临时会话。

关闭 Terminal 后：
- ❌ 命令历史丢失
- ❌ 环境变量丢失
- ❌ cwd 重置

**Phase 2.3+ 可能改进**：
- Terminal Block 持久化到 Event Log
- 恢复上次会话的 cwd 和历史

### Q6: 为什么不支持多个 Terminal 标签？

**A**: Phase 2.1 保持最简实现，只支持单个 Terminal。

**Phase 2.3+ 计划**：
- 多 Terminal 标签
- 每个标签独立的 PTY 会话
- 标签间切换

### Q7: Phase 2.1 和 Phase 2.2 的主要区别是什么？

**A**:

| 功能 | Phase 2.1 | Phase 2.2 |
|------|-----------|-----------|
| Terminal UI | ✅ | ✅ |
| 标准 PTY | ✅ | ✅ |
| 任意目录切换 | ✅ | ✅ |
| workspace 同步 | ❌ | ✅ 自动生成物理文件 |
| 操作 Block 内容 | ❌ | ✅ 直接在 .elf 目录操作 |
| Agent 集成 | ❌ | ✅ Agent 自动化工作流 |

**Phase 2.1 定位**：基础 Terminal，为 Phase 2.2 打基础。

---

**文档作者**: Elfiee Dev Team
**最后更新**: 2026-01-10
