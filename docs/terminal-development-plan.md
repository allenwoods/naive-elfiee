# Terminal 功能开发计划

## 项目状态分析

基于对当前代码的深入分析，发现项目在终端功能实现上存在不一致的状态：

### 当前实现状态

**✅ 已完成（后端）**:
- [x] Terminal Extension (`src-tauri/src/extensions/terminal/`)
  - `terminal.execute` capability 完整实现
  - `TerminalExecutePayload` 类型定义
  - 命令执行逻辑（包含 cd, pwd, ls 特殊处理）
  - 完整的单元测试覆盖
- [x] 系统命令执行（跨平台支持 Windows cmd 和 Unix shell）
- [x] 命令历史记录和状态管理
- [x] 安全验证（路径遍历防护、命令长度限制）

**✅ 已完成（前端基础）**:
- [x] Terminal 组件架构 (`src/components/Terminal.tsx`)
- [x] xterm.js 集成和基础配置
- [x] 会话历史显示逻辑
- [x] 基础 UI 布局

**❌ 缺失的关键组件**:
- [ ] TauriClient.terminal 接口（已被删除）
- [ ] 前端到后端的命令执行调用
- [ ] 会话持久化前端接口

### 关键问题

1. **接口不匹配**: 前端 Terminal.tsx 调用不存在的 `TauriClient.terminal.executeTerminalCommand`
2. **架构简化**: 之前的 PTY 相关代码已删除，只保留简单命令执行
3. **功能完整性**: 后端 capability 完整，但缺少前端调用方式

## 开发计划

### Phase 1: 修复核心功能 (优先级: 高) - 2-3 天

#### 1.1 重建 TauriClient Terminal 接口

**目标**: 基于 `terminal.execute` capability 重建前端调用接口，并通过事件仓库获取终端状态

**文件**: `src/lib/tauri-client.ts`

**具体任务**:
```typescript
// 添加 TerminalOperations 类
export class TerminalOperations {
  private static async getLatestTerminalEvent(fileId: string, blockId: string) {
    const events = await FileOperations.getAllEvents(fileId)
    const terminalEvents = events.filter(
      (event) => event.entity === blockId && event.attribute.endsWith('/terminal.execute')
    )
    if (terminalEvents.length === 0) {
      return null
    }
    return terminalEvents[terminalEvents.length - 1]
  }
  /**
   * 执行终端命令
   * 使用 terminal.execute capability
   */
  static async executeCommand(
    fileId: string,
    blockId: string,
    command: string,
    editorId: string = DEFAULT_EDITOR_ID
  ): Promise<Event[]> {
    const payload: TerminalExecutePayload = { command }
    const cmd = createCommand(
      editorId,
      'terminal.execute',
      blockId,
      payload as unknown as JsonValue
    )
    return await BlockOperations.executeCommand(fileId, cmd)
  }

  /**
   * 获取终端块的命令历史
   */
  static async getTerminalHistory(
    fileId: string,
    blockId: string
  ): Promise<TerminalCommandEntry[]> {
    const latestEvent = await this.getLatestTerminalEvent(fileId, blockId)
    const contents = latestEvent?.value?.contents as any
    return (contents?.history as TerminalCommandEntry[] | undefined) ?? []
  }

  /**
   * 获取当前工作目录
   */
  static async getCurrentDirectory(
    fileId: string,
    blockId: string
  ): Promise<string> {
    const latestEvent = await this.getLatestTerminalEvent(fileId, blockId)
    const contents = latestEvent?.value?.contents as any
    return contents?.current_directory || 'block-root'
  }
}

// 添加类型定义
export interface TerminalCommandEntry {
  command: string
  output: string
  timestamp: string
  exit_code: number
}
```

**更新 TauriClient 导出**:
```typescript
export const TauriClient = {
  file: FileOperations,
  block: BlockOperations,
  editor: EditorOperations,
  terminal: TerminalOperations, // 新增
}
```

**预估工作量**: 1 天

#### 1.2 修复前端 Terminal 组件

**目标**: 修复前端组件，使用新的 TauriClient.terminal 接口

**文件**: `src/components/Terminal.tsx`

**具体任务**:
```typescript
// 修复命令执行逻辑
const handleCommand = async (command: string) => {
  if (!command.trim() || !activeFileId || !currentBlockId || !editor) {
    return
  }

  const terminal = xtermRef.current
  if (!terminal) return

  try {
    terminal.writeln(`$ ${command}`)
    terminal.writeln('Executing...')
    
    // 使用新的 terminal.execute capability
    const events = await TauriClient.terminal.executeCommand(
      activeFileId,
      currentBlockId,
      command,
      editor.editor_id
    )
    
    // 重新获取更新后的 block 内容
    const updatedBlock = await TauriClient.block.getBlock(activeFileId, currentBlockId)
    
    if (updatedBlock.contents && typeof updatedBlock.contents === 'object') {
      const contents = updatedBlock.contents as any
      const history = contents.history || []
      
      if (history.length > 0) {
        const lastEntry = history[history.length - 1]
        
        // 清除 "Executing..." 行并显示结果
        terminal.write('\x1b[1A\x1b[2K\r') // 上移一行并清除
        
        if (lastEntry.output) {
          terminal.writeln(lastEntry.output)
        }
        
        if (lastEntry.exit_code !== 0) {
          terminal.writeln(`\x1b[31m✗ Exit code: ${lastEntry.exit_code}\x1b[0m`)
        }
      }
      
      // 更新当前目录提示符
      const currentDir = contents.current_directory || 'block-root'
      currentDirectoryRef.current = currentDir
      terminal.write(`\r\n${currentDir} $ `)
    }
    
  } catch (error) {
    terminal.write('\x1b[1A\x1b[2K\r') // 清除 "Executing..."
    terminal.writeln(`\x1b[31mError: ${error instanceof Error ? error.message : String(error)}\x1b[0m`)
    terminal.write(`\r\n${currentDirectoryRef.current} $ `)
  }
}
```

**修复会话加载逻辑**:
```typescript
// 加载历史命令
useEffect(() => {
  if (!activeFileId || !terminalBlockId) return
  
  const loadHistory = async () => {
    try {
      const history = await TauriClient.terminal.getTerminalHistory(activeFileId, terminalBlockId)
      const currentDir = await TauriClient.terminal.getCurrentDirectory(activeFileId, terminalBlockId)
      
      currentDirectoryRef.current = currentDir
      
      if (xtermRef.current && history.length > 0) {
        xtermRef.current.writeln('\r\n--- Session History ---')
        history.forEach(entry => {
          xtermRef.current?.writeln(`$ ${entry.command}`)
          if (entry.output) {
            xtermRef.current?.writeln(entry.output)
          }
        })
        xtermRef.current.write(`\r\n${currentDir} $ `)
      }
    } catch (error) {
      console.error('Failed to load terminal history:', error)
    }
  }
  
  loadHistory()
}, [activeFileId, terminalBlockId])
```

**预估工作量**: 1-2 天

### Phase 2: 用户体验优化 (优先级: 中) - 2-3 天

#### 2.1 命令历史导航

**目标**: 实现上下箭头键导航命令历史

**具体任务**:
```typescript
const [commandHistory, setCommandHistory] = useState<string[]>([])
const [historyIndex, setHistoryIndex] = useState(-1)

// 添加键盘事件处理
terminal.onKey(({ key, domEvent }) => {
  if (domEvent.key === 'ArrowUp') {
    // 显示上一个命令
    if (historyIndex < commandHistory.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const historicalCommand = commandHistory[commandHistory.length - 1 - newIndex]
      // 更新输入行
      updateInputLine(historicalCommand)
    }
    domEvent.preventDefault()
  } else if (domEvent.key === 'ArrowDown') {
    // 显示下一个命令
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      const historicalCommand = commandHistory[commandHistory.length - 1 - newIndex]
      updateInputLine(historicalCommand)
    } else if (historyIndex === 0) {
      setHistoryIndex(-1)
      updateInputLine('')
    }
    domEvent.preventDefault()
  }
})

const updateInputLine = (command: string) => {
  const terminal = xtermRef.current
  if (!terminal) return
  
  // 清除当前输入行
  terminal.write('\r\x1b[K')
  terminal.write(`${currentDirectoryRef.current} $ ${command}`)
}
```

**预估工作量**: 1 天

#### 2.2 快捷键支持

**目标**: 实现 Ctrl+L 清屏等快捷键

**具体任务**:
```typescript
// 快捷键处理
terminal.onKey(({ key, domEvent }) => {
  if (domEvent.ctrlKey) {
    switch (domEvent.key) {
      case 'l': // Ctrl+L 清屏
        terminal.clear()
        terminal.write(`${currentDirectoryRef.current} $ `)
        domEvent.preventDefault()
        break
      case 'c': // Ctrl+C 中断 (当前版本显示提示)
        terminal.writeln('^C')
        terminal.write(`${currentDirectoryRef.current} $ `)
        domEvent.preventDefault()
        break
      case 's': // Ctrl+S 保存 (未来实现)
        // TODO: 实现会话保存功能
        domEvent.preventDefault()
        break
    }
  }
})
```

**预估工作量**: 0.5 天

#### 2.3 错误处理和加载状态

**目标**: 改进用户反馈

**具体任务**:
- 添加命令执行加载指示器
- 改进错误消息显示
- 添加连接状态指示

**预估工作量**: 0.5 天

### Phase 3: 高级功能 (优先级: 低) - 1-2 天

#### 3.1 自动完成（基础版本）

**目标**: 基于命令历史的简单自动完成

#### 3.2 终端主题配置

**目标**: 支持多种颜色主题

## 实施时间线

### 第一周
- **Day 1**: 重建 TauriClient Terminal 接口
- **Day 2**: 修复前端 Terminal 组件核心功能
- **Day 3**: 测试和 Bug 修复
- **Day 4**: 命令历史导航实现
- **Day 5**: 快捷键支持和用户体验优化

### 第二周（可选）
- **Day 6-7**: 高级功能实现
- **Day 8**: 完整测试和文档更新

## 技术要点

### 关键决策

1. **架构简化**: 放弃 PTY 交互式支持，专注于简单命令执行
2. **基于 Capability**: 使用现有的 `terminal.execute` capability
3. **前端驱动**: 前端负责 UI 交互，后端负责命令执行

### 实现重点

1. **类型安全**: 使用 `TerminalExecutePayload` 确保类型一致性
2. **错误处理**: 完善的错误处理和用户反馈
3. **状态管理**: 正确管理终端状态和命令历史

### 测试策略

1. **单元测试**: 
   - TauriClient.terminal 方法
   - Terminal 组件核心功能
2. **集成测试**:
   - 端到端命令执行流程
   - 会话状态管理
3. **用户测试**:
   - 常用命令执行
   - 错误场景处理

## 风险和缓解

### 主要风险
1. **前后端接口不匹配**: 通过严格的类型检查缓解
2. **命令执行安全性**: 依赖后端已有的安全措施
3. **用户体验不一致**: 通过充分测试确保一致性

### 缓解策略
1. 分阶段实施，每阶段充分测试
2. 保持与 terminal.execute capability 的接口一致性
3. 参考成熟终端应用的 UX 设计

## 成功指标

### 功能完整性
- [x] 基础命令执行（ls, pwd, echo 等）
- [x] 特殊命令处理（cd）
- [ ] 命令历史导航
- [ ] 错误处理和反馈

### 用户体验
- 响应时间 < 200ms
- 界面流畅无卡顿
- 错误信息清晰易懂

### 代码质量
- TypeScript 类型安全
- 完整的错误处理
- 代码可维护性好

## 总结

当前的开发计划专注于修复和完善现有的简单终端功能，确保用户能够正常执行基础命令。通过基于现有的 `terminal.execute` capability 重建前端接口，可以快速恢复终端功能的正常工作。

这个方案避免了复杂的 PTY 集成，符合当前项目"简单命令执行"的定位，同时为未来的功能扩展保留了架构空间。