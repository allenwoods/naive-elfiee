# Terminal Extension 需求文档

## 需求概述

在 Elfiee 项目中添加终端功能，使用 `xterm.js` 在前端展示终端界面。终端命令执行后，将所有内容记录到临时 JSON 文件中，只有在用户点击 Terminal 组件中的 Save 按钮时，才将这些内容与 Event Store 关联起来。

## 核心需求

### 1. 前端需求

- **添加 Terminal Tab**：在 `App.tsx` 中，在现有的 `events` Tab 旁边新增 `terminal` Tab
- **集成 xterm.js**：使用 `@xterm/xterm` 库渲染终端界面
- **命令执行**：用户输入命令后，发送到后端真正执行系统命令
- **内容获取**：使用 xterm.js 的 API 获取终端缓冲区的所有内容
- **临时存储**：将终端内容保存到临时 JSON 文件

### 2. 后端需求

- **创建 Terminal Extension**：类似于 `markdown` 扩展，创建一个新的 `terminal` 扩展
- **命令执行能力**：实现 `terminal.execute` capability，用于执行系统命令
  - **不进行任何特殊处理**：所有命令都直接执行，包括 `cd`、`pwd`、`ls` 等
  - 使用 `std::process::Command` 真正执行系统命令
  - 捕获 stdout、stderr 和 exit code
- **临时文件管理**：将命令执行记录保存到临时 JSON 文件
- **Save 时关联**：在 Terminal 组件的 Save 按钮点击时，将临时文件变为永久文件（移动到永久存储位置）

### 3. 数据存储设计

#### 临时 JSON 文件结构
```json
{
  "terminal_session": {
    "file_id": "file-xxx",
    "block_id": "terminal-block-xxx",
    "start_time": "2025-01-XX...",
    "last_update": "2025-01-XX...",
    "terminal_content": "完整的终端缓冲区内容（字符串）",
    "command_history": [
      {
        "command": "echo hello",
        "output": "hello",
        "timestamp": "2025-01-XX...",
        "exit_code": 0
      }
    ]
  }
}
```

#### Save 时的事件结构
```json
{
  "entity": "terminal-block-uuid",
  "attribute": "editor-id/terminal.execute",
  "value": {
    "contents": {
      "terminal_content": "完整的终端缓冲区内容",
      "command_history": [...],
      "last_saved": "2025-01-XX..."
    }
  }
}
```

### 4. Block 关联需求

- **打开终端前必须选中 Block**：如果没有选中 block，显示提示信息
- **默认目录**：终端打开时，默认进入选中 block 的目录路径（`block-{block_id}`）
- **注意**：由于不特殊处理 `cd` 命令，目录切换将依赖系统命令的实际行为

### 5. xterm.js 内容获取方式

xterm.js 提供了多种方式获取终端内容：

#### 5.1 获取缓冲区内容（推荐）

```typescript
// 获取所有可见行的内容
const buffer = terminal.buffer.active;
const lines: string[] = [];
for (let i = 0; i < buffer.length; i++) {
  const line = buffer.getLine(i);
  if (line) {
    lines.push(line.translateToString(true)); // true = 包含样式
  }
}
const fullContent = lines.join('\n');
```

#### 5.2 获取所有行（包括滚动历史）

```typescript
// 获取所有行（包括滚动缓冲区）
const buffer = terminal.buffer.normal; // 或 terminal.buffer.active
const lines: string[] = [];
for (let i = 0; i < buffer.length; i++) {
  const line = buffer.getLine(i);
  if (line) {
    lines.push(line.translateToString(true));
  }
}
const fullContent = lines.join('\n');
```

#### 5.3 使用 onData 监听（累积内容）

```typescript
let terminalContent = '';
terminal.onData((data) => {
  terminalContent += data;
});
// 或者使用 onLineFeed
terminal.onLineFeed(() => {
  // 获取当前行内容
  const line = terminal.buffer.active.getLine(terminal.buffer.active.cursorY);
  if (line) {
    terminalContent += line.translateToString(true) + '\n';
  }
});
```

#### 5.4 获取指定范围的内容

```typescript
// 获取指定行范围的内容
function getLinesRange(terminal: Terminal, start: number, end: number): string {
  const buffer = terminal.buffer.active;
  const lines: string[] = [];
  for (let i = start; i <= end && i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (line) {
      lines.push(line.translateToString(true));
    }
  }
  return lines.join('\n');
}
```

#### 5.5 完整实现示例

```typescript
/**
 * 获取终端缓冲区的完整内容
 * @param terminal - xterm.js Terminal 实例
 * @param includeScrollback - 是否包含滚动历史（默认 true）
 * @returns 完整的终端内容字符串
 */
function getTerminalContent(
  terminal: Terminal,
  includeScrollback: boolean = true
): string {
  // 使用 normal buffer 获取包括滚动历史的所有内容
  // 使用 active buffer 只获取可见区域
  const buffer = includeScrollback 
    ? terminal.buffer.normal 
    : terminal.buffer.active;
  
  const lines: string[] = [];
  
  // 遍历所有行
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (line) {
      // translateToString(true) 包含格式，false 只包含文本
      const lineText = line.translateToString(true);
      if (lineText.trim() || i === buffer.length - 1) {
        // 保留非空行和最后一行
        lines.push(lineText);
      }
    }
  }
  
  return lines.join('\n');
}
```

## 技术实现要点

### 1. 临时文件管理

- **临时文件位置**：存储在系统临时目录 `{temp_dir}/elfiee-terminal-sessions/`
- **临时文件命名**：`terminal-{file_id}-{block_id}.json`
- **永久文件位置**：存储在应用数据目录 `{app_data_dir}/elfiee-terminal-sessions/`
- **永久文件命名**：`terminal-{file_id}-{block_id}.json`
- **更新时机**：每次命令执行后更新临时文件
- **Save 时机**：Save 成功后，将临时文件移动到永久存储位置（变为永久文件）

### 2. Save 按钮集成

在 `Terminal.tsx` 组件中添加 Save 按钮：
1. 按钮位于终端界面上方（工具栏区域）
2. 点击时执行以下操作：
   - 获取最新的终端缓冲区内容（使用 xterm.js API）
   - 更新临时 JSON 文件中的 `terminal_content`
   - 调用 `terminal.save` capability 保存内容到 Event Store
   - 将临时文件移动到永久存储位置（变为永久文件）
   - 在终端中显示保存成功消息

### 3. 命令执行流程

```
用户输入命令
  ↓
前端：发送到后端 terminal.execute
  ↓
后端：执行系统命令（std::process::Command）
  ↓
后端：返回输出和 exit code
  ↓
前端：显示输出到 xterm.js
  ↓
前端：更新临时 JSON 文件（包含命令历史）
  ↓
前端：使用 xterm.js API 获取完整缓冲区内容，更新临时文件
  ↓
用户点击 Terminal 中的 Save 按钮
  ↓
前端：获取最新的终端缓冲区内容（xterm.js API）
  ↓
前端：更新临时 JSON 文件中的 terminal_content
  ↓
前端：读取临时文件
  ↓
后端：调用 terminal.save capability，创建 Event，将内容保存到 Event Store
  ↓
后端：将临时文件从临时目录移动到永久存储目录（变为永久文件）
```

### 4. 不特殊处理命令

- **cd 命令**：由系统 shell 处理，在子进程中切换目录
- **pwd 命令**：由系统 shell 执行，返回实际工作目录
- **ls 命令**：由系统 shell 执行，列出实际文件系统内容
- **所有命令**：都通过 `std::process::Command` 执行，不做任何拦截或特殊处理

## 实现检查清单

- [ ] 前端：集成 xterm.js，实现终端界面
- [ ] 前端：实现命令输入和输出显示
- [ ] 前端：实现获取终端缓冲区内容的函数
- [ ] 前端：实现临时 JSON 文件的读写
- [ ] 后端：实现 `terminal.execute` capability（真正执行系统命令）
- [ ] 后端：移除所有命令的特殊处理逻辑
- [ ] 后端：实现临时文件管理（保存、读取、删除）
- [ ] Terminal：添加 Save 按钮并实现保存功能
- [ ] 测试：验证命令执行和内容记录

## 注意事项

1. **安全性**：执行系统命令需要谨慎，确保有适当的权限控制
2. **性能**：获取大量终端内容时，注意性能影响
3. **编码**：确保终端内容的编码正确处理（UTF-8）
4. **文件移动**：Save 时确保临时文件成功移动到永久存储位置
5. **并发**：多个终端会话时，临时文件和永久文件都需要唯一命名
6. **永久存储位置**：
   - Windows: `%APPDATA%\elfiee\terminal-sessions\`
   - macOS: `~/Library/Application Support/elfiee/terminal-sessions/`
   - Linux: `~/.local/share/elfiee/terminal-sessions/`

