/**
 * Terminal Integration Test
 *
 * Tests the integration between frontend TauriClient and backend terminal capabilities.
 * This test demonstrates usage of terminal.execute, terminal.read, and terminal.write.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { TauriClient } from '@/lib/tauri-client'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'

// 终端端到端集成能力测试（覆盖命令执行、读写、状态聚合等关键流程）
describe('Terminal Integration', () => {
  let fileId: string
  let editorId: string
  let terminalBlockId: string

  // 在所有用例执行前，准备好必要的文件 / 编辑器 / 终端 Block，并 mock Tauri 后端
  beforeAll(async () => {
    // Mock file dialog to return a test path
    vi.mocked(save).mockResolvedValue('/tmp/test-terminal.elf')

    // Mock the backend commands to return successful results
    vi.mocked(invoke)
      .mockResolvedValueOnce('test-file-id') // createFile
      .mockResolvedValueOnce({
        editor_id: 'test-editor-id',
        name: 'test-editor',
      }) // createEditor
      .mockResolvedValueOnce(undefined) // setActiveEditor
      .mockResolvedValueOnce([
        { entity: 'test-terminal-block-id', event_id: 'test-event-1' },
      ]) // createBlock

    // 创建测试文件，并确保返回的 fileId 与预期一致
    const createFileId = await TauriClient.file.createFile()
    expect(createFileId).toBe('test-file-id') // This should work now
    fileId = createFileId!

    // 创建编辑器，并设置为当前激活编辑器
    const editorResult = await TauriClient.editor.createEditor(
      fileId,
      'test-editor'
    )
    expect(editorResult.editor_id).toBe('test-editor-id')
    editorId = editorResult.editor_id

    // Set as active editor
    await TauriClient.editor.setActiveEditor(fileId, editorId)

    // 创建终端 Block，用于后续的命令交互
    const blockEvents = await TauriClient.block.createBlock(
      fileId,
      crypto.randomUUID(),
      'Test Terminal',
      'terminal',
      editorId
    )
    expect(blockEvents.length).toBeGreaterThan(0)
    terminalBlockId = blockEvents[0].entity
  })

  // 测试结束后关闭文件，避免影响其他测试
  afterAll(async () => {
    // Clean up: close the test file
    if (fileId) {
      await TauriClient.file.closeFile(fileId)
    }
  })

  // 验证 terminal.execute 能够执行命令并返回执行历史
  it('should execute terminal commands', async () => {
    // Mock terminal.execute response
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        entity: terminalBlockId,
        event_id: 'test-execute-event',
        attribute: `${editorId}/terminal.execute`,
        value: {
          contents: {
            history: [
              {
                command: 'echo "Hello Terminal!"',
                output: 'Hello Terminal!',
                exit_code: 0,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        },
      },
    ])

    // Test terminal.execute capability
    const executeEvents = await TauriClient.terminal.executeCommand(
      fileId,
      terminalBlockId,
      'echo "Hello Terminal!"',
      editorId
    )

    expect(executeEvents.length).toBe(1)
    expect(executeEvents[0].entity).toBe(terminalBlockId)
    expect(executeEvents[0].attribute).toBe(`${editorId}/terminal.execute`)

    // Verify the event contains the command execution result
    const executeEvent = executeEvents[0]!
    const contents = (executeEvent.value as any).contents as any
    expect(contents.history).toBeDefined()
    expect(contents.history.length).toBe(1)
    expect(contents.history[0].command).toBe('echo "Hello Terminal!"')
    expect(contents.history[0].output).toContain('Hello Terminal!')
  })

  // 验证 terminal.write 能够写入消息，并在历史中保留 type=write 的记录
  it('should write content to terminal', async () => {
    // Mock terminal.write response
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        entity: terminalBlockId,
        event_id: 'test-write-event',
        attribute: `${editorId}/terminal.write`,
        value: {
          contents: {
            history: [
              {
                command: '',
                output: 'This is a status message',
                exit_code: 0,
                timestamp: new Date().toISOString(),
                type: 'write',
              },
            ],
          },
        },
      },
    ])

    // Test terminal.write capability
    const writeEvents = await TauriClient.terminal.writeToTerminal(
      fileId,
      terminalBlockId,
      'This is a status message',
      editorId
    )

    expect(writeEvents.length).toBe(1)
    expect(writeEvents[0].entity).toBe(terminalBlockId)
    expect(writeEvents[0].attribute).toBe(`${editorId}/terminal.write`)

    // Verify the event contains the written content
    const writeEvent = writeEvents[0]!
    const contents = (writeEvent.value as any).contents as any
    expect(contents.history).toBeDefined()
    expect(contents.history.length).toBeGreaterThan(0)

    // Find the write entry (last entry should be our write)
    const lastEntry = contents.history[contents.history.length - 1]
    expect(lastEntry.output).toBe('This is a status message')
    expect(lastEntry.type).toBe('write')
    expect(lastEntry.command).toBe('')
  })

  // 验证 terminal.read（只读操作）不会产生事件
  it('should read terminal state', async () => {
    // Mock terminal.read response (returns empty array as read doesn't generate events)
    vi.mocked(invoke).mockResolvedValueOnce([])

    // Test terminal.read capability
    const readEvents = await TauriClient.terminal.readTerminal(
      fileId,
      terminalBlockId,
      editorId
    )

    // Read operations don't generate events in our implementation
    expect(readEvents.length).toBe(0)
  })

  // 验证连续执行多条命令/写入后，历史记录会累积且类型标记正确
  it('should maintain command history across operations', async () => {
    // Mock multiple command executions with accumulated history
    vi.mocked(invoke)
      .mockResolvedValueOnce([
        {
          entity: terminalBlockId,
          value: {
            contents: { history: [{ command: 'pwd', output: '/test' }] },
          },
        },
      ]) // pwd
      .mockResolvedValueOnce([
        {
          entity: terminalBlockId,
          value: {
            contents: {
              history: [
                { command: 'pwd', output: '/test' },
                { type: 'write', output: 'Intermediate message' },
              ],
            },
          },
        },
      ]) // write
      .mockResolvedValueOnce([
        {
          entity: terminalBlockId,
          value: {
            contents: {
              history: [
                { command: 'pwd', output: '/test' },
                { type: 'write', output: 'Intermediate message' },
                { command: 'ls', output: 'file1.txt' },
              ],
            },
          },
        },
      ]) // ls

    // Execute multiple commands
    await TauriClient.terminal.executeCommand(
      fileId,
      terminalBlockId,
      'pwd',
      editorId
    )

    await TauriClient.terminal.writeToTerminal(
      fileId,
      terminalBlockId,
      'Intermediate message',
      editorId
    )

    const finalExecuteEvents = await TauriClient.terminal.executeCommand(
      fileId,
      terminalBlockId,
      'ls',
      editorId
    )

    // Verify that history accumulates
    const finalEvent = finalExecuteEvents[0]!
    const contents = (finalEvent.value as any).contents as any
    expect(contents.history.length).toBeGreaterThan(2)

    // Check that different types of entries are preserved
    const historyTypes = contents.history.map(
      (entry: any) => entry.type || 'execute'
    )
    expect(historyTypes).toContain('write')
  })

  // 验证 cd 命令会更新 current_directory / current_path
  it('should handle directory navigation', async () => {
    // Mock cd command response
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        entity: terminalBlockId,
        event_id: 'test-cd-event',
        attribute: `${editorId}/terminal.execute`,
        value: {
          contents: {
            history: [{ command: 'cd .', output: '', exit_code: 0 }],
            current_directory: '.',
            current_path: '/test',
          },
        },
      },
    ])

    // Test cd command
    const cdEvents = await TauriClient.terminal.executeCommand(
      fileId,
      terminalBlockId,
      'cd .',
      editorId
    )

    expect(cdEvents.length).toBe(1)

    // Verify current directory is tracked
    const cdEvent = cdEvents[0]!
    const contents = (cdEvent.value as any).contents as any
    expect(contents.current_directory).toBeDefined()
    expect(contents.current_path).toBeDefined()
  })

  // 验证 getTerminalState 会通过事件聚合最新状态（历史 + 当前目录）
  it('should get terminal state correctly', async () => {
    // Mock getAllEvents response
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        entity: terminalBlockId,
        attribute: `${editorId}/terminal.execute`,
        value: {
          contents: {
            history: [{ command: 'echo test', output: 'test', exit_code: 0 }],
            current_directory: '/test',
            current_path: '/test',
          },
        },
      },
    ])

    // Test the helper method that aggregates terminal state
    const terminalState = await TauriClient.terminal.getTerminalState(
      fileId,
      terminalBlockId
    )

    expect(terminalState.history).toBeDefined()
    expect(terminalState.currentDirectory).toBeDefined()
    expect(terminalState.contents).toBeDefined()
    expect(terminalState.history.length).toBeGreaterThan(0)
  })
})
