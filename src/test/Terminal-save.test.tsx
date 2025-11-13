/**
 * Terminal Save Functionality Tests
 *
 * Tests for the new terminal save functionality that saves terminal buffer content
 * to block contents and restores it when the block is selected.
 *
 * Features tested:
 * - Terminal buffer content extraction and save to block contents
 * - Recovery of saved content when selecting terminal block
 * - UI status indicators for saved content
 * - getTerminalSaveInfo helper function
 * - terminal.write capability with saved_content payload
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Terminal } from '@/components/Terminal'
import type { Block, Editor } from '@/bindings'

// 当前 Mock Terminal 实例（便于断言 writeln / write 等行为）
let currentTerminal: any = null
// 通过可配置的 buffer 行数组来模拟终端缓冲区内容
let terminalBufferLines: string[] = []

const setTerminalBufferLines = (lines: string[]) => {
  terminalBufferLines = [...lines]
}

// 创建与 xterm 行缓冲结构类似的对象，帮助 save 逻辑提取文本
const createTerminalBuffer = () => ({
  active: {
    cursorX: 0,
    get length() {
      return terminalBufferLines.length
    },
    getLine: vi.fn((index: number) => ({
      translateToString: vi.fn(() => terminalBufferLines[index] || ''),
    })),
  },
})

vi.mock('@xterm/xterm', () => {
  // 自定义 MockTerminal，模拟 new Terminal() 场景及相关方法
  class MockTerminal {
    open: ReturnType<typeof vi.fn>
    writeln: ReturnType<typeof vi.fn>
    write: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
    loadAddon: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
    onData: ReturnType<typeof vi.fn>
    buffer: ReturnType<typeof createTerminalBuffer>

    constructor() {
      this.open = vi.fn()
      this.writeln = vi.fn()
      this.write = vi.fn()
      this.clear = vi.fn()
      this.loadAddon = vi.fn()
      this.dispose = vi.fn()
      this.onData = vi.fn(() => ({ dispose: vi.fn() }))
      this.buffer = createTerminalBuffer()
      currentTerminal = this
    }
  }

  return {
    Terminal: MockTerminal,
  }
})

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit: ReturnType<typeof vi.fn>

    constructor() {
      this.fit = vi.fn()
    }
  }

  return { FitAddon: MockFitAddon }
})

vi.mock('@/lib/tauri-client', () => ({
  TauriClient: {
    block: {
      executeCommand: vi.fn(),
      getAllBlocks: vi.fn(),
    },
    terminal: {
      getTerminalHistory: vi.fn(),
      getTerminalState: vi.fn(),
    },
  },
}))

const mockAppStore = {
  activeFileId: 'test-file-id',
  getSelectedBlock: vi.fn(),
  getActiveEditor: vi.fn(),
  getActiveFile: vi.fn(),
  selectBlock: vi.fn(),
  addNotification: vi.fn(),
}

vi.mock('@/lib/app-store', () => ({
  useAppStore: () => mockAppStore,
}))

describe('Terminal Save Functionality', () => {
  const mockEditor: Editor = {
    editor_id: 'test-editor',
    name: 'Test Editor',
  }

  const mockTerminalBlockWithoutSave: Block = {
    block_id: 'terminal-block-1',
    name: 'Terminal Block',
    block_type: 'terminal',
    contents: {},
    children: {},
    owner: 'test-editor',
  }

  const mockTerminalBlockWithSave: Block = {
    block_id: 'terminal-block-2',
    name: 'Saved Terminal Block',
    block_type: 'terminal',
    contents: {
      saved_content:
        'Welcome to Elfiee Terminal!\nCurrent directory: .\n$ ls\nfile1.txt  file2.txt\n$ pwd\n/home/user',
      saved_at: '2024-01-15T14:30:25.123Z',
      current_directory: '/home/user',
    },
    children: {},
    owner: 'test-editor',
  }

  let mockExecuteCommand: ReturnType<typeof vi.fn>
  let mockGetAllBlocks: ReturnType<typeof vi.fn>
  let mockGetTerminalHistory: ReturnType<typeof vi.fn>
  let mockGetTerminalState: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    currentTerminal = null
    setTerminalBufferLines([])

    const { TauriClient } = await import('@/lib/tauri-client')
    mockExecuteCommand = vi.mocked(TauriClient.block.executeCommand)
    mockGetAllBlocks = vi.mocked(TauriClient.block.getAllBlocks)
    mockGetTerminalHistory = vi.mocked(TauriClient.terminal.getTerminalHistory)
    mockGetTerminalState = vi.mocked(TauriClient.terminal.getTerminalState)

    vi.clearAllMocks()
    mockAppStore.getActiveEditor.mockReturnValue(mockEditor)
    mockAppStore.getSelectedBlock.mockReturnValue(mockTerminalBlockWithoutSave)
    mockGetAllBlocks.mockResolvedValue([mockTerminalBlockWithoutSave])
    mockGetTerminalHistory.mockResolvedValue([])
    mockGetTerminalState.mockResolvedValue({
      history: [],
      currentDirectory: '.',
      contents: {},
    })
    mockExecuteCommand.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const waitForTerminalInstance = async () => {
    // 等待 Terminal 组件初始化完成并挂载 xterm 实例
    await waitFor(() => {
      expect(currentTerminal).not.toBeNull()
    })
    return currentTerminal!
  }

  describe('getTerminalSaveInfo helper function', () => {
    // 通过组件行为间接验证内部 getTerminalSaveInfo 的逻辑
    it('should detect block without saved content', async () => {
      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      expect(saveButton).toHaveTextContent('Save')
      expect(saveButton).not.toHaveTextContent('Update Save')
      expect(screen.queryByText(/• Saved/)).not.toBeInTheDocument()
    })

    it('should detect block with saved content', async () => {
      mockAppStore.getSelectedBlock.mockReturnValue(mockTerminalBlockWithSave)
      mockGetAllBlocks.mockResolvedValue([mockTerminalBlockWithSave])

      render(<Terminal />)

      const button = await screen.findByRole('button', { name: /update save/i })
      expect(button).toHaveTextContent('Update Save')
      expect(screen.getByText(/• Saved \(6 lines\)/)).toBeInTheDocument()
    })

    it('should handle invalid saved content', async () => {
      const invalidBlock: Block = {
        ...mockTerminalBlockWithoutSave,
        contents: {
          saved_content: '',
          saved_at: '2024-01-15T14:30:25.123Z',
        },
      }
      mockAppStore.getSelectedBlock.mockReturnValue(invalidBlock)

      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      expect(saveButton).toHaveTextContent('Save')
    })
  })

  describe('Save Operation', () => {
    it('should extract terminal buffer content and save to block', async () => {
      setTerminalBufferLines([
        'Welcome to Elfiee Terminal!',
        'Current directory: .',
        'Type any command to execute.',
        '. $ ls',
        'file1.txt  file2.txt',
      ])
      const user = userEvent.setup()

      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'test-file-id',
          expect.objectContaining({
            cap_id: 'terminal.write',
            block_id: 'terminal-block-1',
            editor_id: 'test-editor',
            payload: expect.objectContaining({
              saved_content: expect.stringContaining(
                'Welcome to Elfiee Terminal!'
              ),
              saved_at: expect.any(String),
              current_directory: '.',
            }),
          })
        )
      })

      expect(mockAppStore.addNotification).toHaveBeenCalledWith(
        'success',
        '终端内容已保存到Block中。'
      )
    })

    it('should show error when no terminal block exists', async () => {
      mockAppStore.getSelectedBlock.mockReturnValue(null)

      render(<Terminal />)

      expect(
        await screen.findByText('终端需要Terminal Block')
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /save/i })
      ).not.toBeInTheDocument()
    })

    it('should show error when no active editor', async () => {
      mockAppStore.getActiveEditor.mockReturnValue(null)
      const user = userEvent.setup()

      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockAppStore.addNotification).toHaveBeenCalledWith(
          'error',
          '没有活跃的编辑器。'
        )
      })
    })

    it('should handle save operation failure', async () => {
      mockExecuteCommand.mockRejectedValueOnce(new Error('Network error'))
      const user = userEvent.setup()

      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockAppStore.addNotification).toHaveBeenCalledWith(
          'error',
          '保存终端内容失败: Network error'
        )
      })
    })
  })

  describe('Content Recovery', () => {
    it('should restore saved terminal content on initialization', async () => {
      mockAppStore.getSelectedBlock.mockReturnValue(mockTerminalBlockWithSave)
      mockGetAllBlocks.mockResolvedValue([mockTerminalBlockWithSave])

      render(<Terminal />)

      const terminal = await waitForTerminalInstance()

      await waitFor(() =>
        expect(terminal.writeln).toHaveBeenCalledWith(
          '=== Restored Terminal Session ==='
        )
      )

      const calls = terminal.writeln.mock.calls.map(
        (callArgs: unknown[]) => callArgs[0] as string
      )
      const savedAtCall = calls.find((value: string) =>
        value.startsWith('Saved at:')
      )
      expect(savedAtCall).toBeDefined()
      const contentStatsCall = calls.find((value: string) =>
        value.startsWith('Content: 6 lines')
      )
      expect(contentStatsCall).toBeDefined()

      expect(calls).toEqual(
        expect.arrayContaining([
          'Welcome to Elfiee Terminal!',
          'Current directory: .',
          '$ ls',
          'file1.txt  file2.txt',
          '$ pwd',
          '/home/user',
          '=== Continue Session ===',
        ])
      )
    })

    it('should show fresh terminal when no saved content', async () => {
      render(<Terminal />)

      const terminal = await waitForTerminalInstance()

      await waitFor(() =>
        expect(terminal.writeln).toHaveBeenCalledWith(
          'Welcome to Elfiee Terminal!'
        )
      )
      expect(terminal.writeln).toHaveBeenCalledWith('Current directory: .')
      expect(terminal.writeln).toHaveBeenCalledWith(
        'Type any command to execute.'
      )
      expect(terminal.writeln).not.toHaveBeenCalledWith(
        '=== Restored Terminal Session ==='
      )
    })

    it('should handle malformed saved content gracefully', async () => {
      const malformedBlock: Block = {
        ...mockTerminalBlockWithSave,
        contents: {
          saved_content: null,
          saved_at: 'invalid-date',
        },
      }
      mockAppStore.getSelectedBlock.mockReturnValue(malformedBlock)
      mockGetAllBlocks.mockResolvedValue([malformedBlock])

      render(<Terminal />)

      const terminal = await waitForTerminalInstance()

      await waitFor(() =>
        expect(terminal.writeln).toHaveBeenCalledWith(
          'Welcome to Elfiee Terminal!'
        )
      )
    })
  })

  describe('UI Status Indicators', () => {
    // 验证顶栏状态展示（目录、保存提示、按钮文案等）
    it('should show saved status in directory info', async () => {
      mockAppStore.getSelectedBlock.mockReturnValue(mockTerminalBlockWithSave)
      mockGetAllBlocks.mockResolvedValue([mockTerminalBlockWithSave])

      render(<Terminal />)

      expect(await screen.findByText(/• Saved \(6 lines\)/)).toBeInTheDocument()
      expect(
        screen.getByText((content) =>
          content.replace(/\s+/g, ' ').includes('Directory: /home/user')
        )
      ).toBeInTheDocument()
    })

    it('should show "Update Save" button for saved content', async () => {
      mockAppStore.getSelectedBlock.mockReturnValue(mockTerminalBlockWithSave)
      mockGetAllBlocks.mockResolvedValue([mockTerminalBlockWithSave])

      render(<Terminal />)

      const button = await screen.findByRole('button', { name: /update save/i })
      expect(button).toHaveTextContent('Update Save')
    })

    it('should show "Save" button for unsaved content', async () => {
      render(<Terminal />)

      const button = await screen.findByRole('button', { name: /save/i })
      expect(button).toHaveTextContent('Save')
      expect(button).not.toHaveTextContent('Update Save')
    })

    it('should disable save button while saving', async () => {
      mockExecuteCommand.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      )
      const user = userEvent.setup()

      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      await user.click(saveButton)

      expect(
        await screen.findByRole('button', { name: /saving/i })
      ).toBeDisabled()
    })
  })

  describe('Integration with terminal.write capability', () => {
    it('should call terminal.write with correct payload structure', async () => {
      setTerminalBufferLines(['. $ echo hello', 'hello'])
      const user = userEvent.setup()

      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'test-file-id',
          expect.objectContaining({
            cmd_id: expect.any(String),
            editor_id: 'test-editor',
            cap_id: 'terminal.write',
            block_id: 'terminal-block-1',
            payload: expect.objectContaining({
              saved_content: expect.any(String),
              saved_at: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
              ),
              current_directory: '.',
            }),
            timestamp: expect.any(String),
          })
        )
      })
    })

    it('should extract multi-line terminal content correctly', async () => {
      setTerminalBufferLines([
        '. $ echo "Hello World"',
        'Hello World',
        '. $ ls -la',
      ])
      const user = userEvent.setup()

      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        const call = mockExecuteCommand.mock.calls[0]
        const payload = call[1].payload
        expect(payload.saved_content).toContain('. $ echo "Hello World"')
        expect(payload.saved_content).toContain('Hello World')
        expect(payload.saved_content).toContain('. $ ls -la')
      })
    })
  })
})
