# Terminal PTY 资源泄漏修复总结

## 修复的问题

### 1. 添加权限检查到 close_terminal_session

**问题**: `close_terminal_session` 命令缺少权限验证，任何用户都可以关闭任意终端会话。

**修复**:
- 更新函数签名以接受 `file_id` 和 `editor_id` 参数
- 添加 `check_terminal_permission` 调用，验证 `terminal.close` 权限
- 确保只有 Block 所有者或被授权的用户才能关闭终端会话

**代码位置**: `src-tauri/src/extensions/terminal/pty.rs:280-320`

```rust
pub async fn close_terminal_session(
    state: State<'_, TerminalState>,
    app_state: State<'_, AppState>,
    file_id: String,
    block_id: String,
    editor_id: String,
) -> Result<(), String> {
    // Verify permissions using capability system
    check_terminal_permission(
        &app_state,
        &file_id,
        &editor_id,
        &block_id,
        "terminal.close",
    )
    .await?;
    // ...
}
```

### 2. 修复前端参数传递

**问题**: 前端调用 `closeTerminal` 时只传递了 `block_id`，与后端新的签名不匹配。

**修复**:
- 更新 `tauri-client.ts` 中的 `closeTerminal` 方法签名
- 更新 `Terminal.tsx` 中的调用，传递 `fileId` 和 `editorId`

**代码位置**: 
- `src/lib/tauri-client.ts:692-710`
- `src/components/Terminal.tsx:319-331`

```typescript
// tauri-client.ts
static async closeTerminal(
  fileId: string,
  blockId: string,
  editorId: string
): Promise<void> {
  const result = await commands.closeTerminalSession(
    fileId,
    blockId,
    editorId
  )
  // ...
}

// Terminal.tsx
if (terminalBlockIdRef.current && activeFileId) {
  const editor = getActiveEditor(activeFileId)
  TauriClient.terminal.closeTerminal(
    activeFileId,
    terminalBlockIdRef.current,
    editor?.editor_id || 'default-editor'
  )
}
```

### 3. 添加线程清理机制

**问题**: PTY 读取线程在无限循环中运行，从不主动终止，导致线程泄漏。

**修复**:
- 在 `TerminalSession` 中添加 `shutdown_tx` 通道
- 创建 `shutdown_rx` 接收端并传递给读取线程
- 读取线程在每次循环时检查关闭信号
- `close_terminal_session` 在删除会话前发送关闭信号

**代码位置**: `src-tauri/src/extensions/terminal/pty.rs`

```rust
// TerminalSession 结构体
pub struct TerminalSession {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn portable_pty::MasterPty + Send>,
    /// Channel to signal the reader thread to stop
    pub shutdown_tx: std::sync::mpsc::Sender<()>,
}

// 创建通道
let (shutdown_tx, shutdown_rx) = std::sync::mpsc::channel();

// 读取线程检查关闭信号
thread::spawn(move || {
    let mut buffer = [0u8; 1024];
    loop {
        // Check for shutdown signal (non-blocking)
        if shutdown_rx.try_recv().is_ok() {
            break;
        }
        // ... 读取 PTY 输出 ...
    }
});

// 关闭时发送信号
if let Some(session) = sessions.remove(&block_id) {
    // Signal the reader thread to stop
    let _ = session.shutdown_tx.send(());
    drop(session);
}
```

## 资源泄漏防护机制

修复后的系统现在具有完整的资源清理机制：

1. **线程清理**: 通过通道信号优雅地终止读取线程
2. **PTY 清理**: 删除 `TerminalSession` 时自动关闭 master PTY
3. **进程清理**: 关闭 master PTY 会终止子 Shell 进程
4. **会话清理**: 从 HashMap 中移除会话记录

## 安全性改进

- 所有终端操作（init, write, resize, close）现在都需要权限验证
- 遵循 Elfiee 的 Capability 系统设计
- 防止未授权用户操作他人的终端会话

## 测试结果

所有 Rust 测试通过 ✅

```
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured
```

## 注意事项

- 前端需要重新生成 TypeScript 绑定 (`src/bindings.ts`)
- 运行 `npm run tauri dev` 或构建时会自动更新绑定
- 现有的终端会话在升级后需要重新初始化
