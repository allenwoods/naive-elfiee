/**
 * Terminal PTY Integration Test
 *
 * Tests the integration between frontend TauriClient and backend PTY commands.
 * This test demonstrates usage of initTerminal, writeToPty, and resizePty.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { setupCommandMocks } from '@/test/mock-tauri-invoke'
import { createMockEvent } from '@/test/setup'

// Mock Tauri APIs - the global mock from setup.ts should be sufficient
// We just need to configure it in beforeAll
import { TauriClient } from '@/lib/tauri-client'
import { invoke } from '@tauri-apps/api/core'

describe('Terminal PTY Integration', () => {
  let fileId: string
  let editorId: string
  let terminalBlockId: string

  beforeAll(async () => {
    // Import and configure save mock - must be done dynamically
    const { save } = await import('@tauri-apps/plugin-dialog')
    vi.mocked(save).mockResolvedValue('/tmp/test-terminal.elf')

    // Mock the backend commands to return successful results
    setupCommandMocks({
      createFile: 'test-file-id',
      createEditor: {
        editor_id: 'test-editor-id',
        name: 'test-editor',
      },
      setActiveEditor: null,
      executeCommand: [
        createMockEvent({
          entity: 'test-terminal-block-id',
          event_id: 'test-event-1',
        }),
      ],
    })

    // Create test file
    const createFileId = await TauriClient.file.createFile()
    expect(createFileId).toBe('test-file-id')
    fileId = createFileId!

    // Create editor
    const editorResult = await TauriClient.editor.createEditor(
      fileId,
      'test-editor'
    )
    expect(editorResult.editor_id).toBe('test-editor-id')
    editorId = editorResult.editor_id

    // Set as active editor
    await TauriClient.editor.setActiveEditor(fileId, editorId)

    // Create terminal block
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

  it('should initialize PTY session with CWD', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null)

    const testCwd = '/tmp/test-cwd'
    await expect(
      TauriClient.terminal.initTerminal(
        terminalBlockId,
        editorId,
        24,
        80,
        testCwd
      )
    ).resolves.toBeUndefined()

    expect(invoke).toHaveBeenCalledWith('async_init_terminal', {
      payload: {
        block_id: terminalBlockId,
        editor_id: editorId,
        rows: 24,
        cols: 80,
        cwd: testCwd,
      },
    })
  })

  it('should initialize PTY session without CWD', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null)

    await expect(
      TauriClient.terminal.initTerminal(terminalBlockId, editorId, 24, 80)
    ).resolves.toBeUndefined()

    expect(invoke).toHaveBeenCalledWith('async_init_terminal', {
      payload: {
        block_id: terminalBlockId,
        editor_id: editorId,
        rows: 24,
        cols: 80,
        cwd: null,
      },
    })
  })

  it('should write data to PTY', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null)

    await expect(
      TauriClient.terminal.writeToPty(terminalBlockId, 'ls\n')
    ).resolves.toBeUndefined()

    expect(invoke).toHaveBeenCalledWith('write_to_pty', {
      payload: {
        block_id: terminalBlockId,
        data: 'ls\n',
      },
    })
  })

  it('should resize PTY', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null)

    await expect(
      TauriClient.terminal.resizePty(terminalBlockId, 30, 100)
    ).resolves.toBeUndefined()

    expect(invoke).toHaveBeenCalledWith('resize_pty', {
      payload: {
        block_id: terminalBlockId,
        rows: 30,
        cols: 100,
      },
    })
  })

  it('should save terminal session', async () => {
    const content = 'Terminal buffer content...'
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        entity: terminalBlockId,
        event_id: 'save-event-1',
        attribute: `${editorId}/terminal.save`,
      },
    ])

    const events = await TauriClient.terminal.saveSession(
      fileId,
      terminalBlockId,
      content,
      editorId
    )

    expect(events.length).toBe(1)
    expect(invoke).toHaveBeenCalledWith('execute_command', {
      fileId,
      cmd: expect.objectContaining({
        cap_id: 'terminal.save',
        block_id: terminalBlockId,
        payload: expect.objectContaining({
          saved_content: content,
          saved_at: expect.any(String),
        }),
      }),
    })
  })

  it('should handle PTY command errors', async () => {
    vi.mocked(invoke).mockRejectedValueOnce('PTY initialization failed')

    await expect(
      TauriClient.terminal.initTerminal(terminalBlockId, editorId, 24, 80)
    ).rejects.toThrow('PTY initialization failed')
  })
})
