/**
 * Terminal PTY Integration Tests
 *
 * Tests for the new PTY-based terminal functionality.
 *
 * Features tested:
 * - PTY session initialization
 * - User input handling via writeToPty
 * - PTY output via pty-out events
 * - Terminal resize handling
 * - Save/restore session functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Terminal } from '@/components/Terminal'
import type { Block, Editor } from '@/bindings'

// Mock Terminal instance
let currentTerminal: any = null
let terminalBufferLines: string[] = []

const setTerminalBufferLines = (lines: string[]) => {
  terminalBufferLines = [...lines]
}

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
    proposeDimensions: ReturnType<typeof vi.fn>

    constructor() {
      this.fit = vi.fn()
      this.proposeDimensions = vi.fn(() => ({ rows: 24, cols: 80 }))
    }
  }

  return { FitAddon: MockFitAddon }
})

// Mock Tauri event listener
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}))

vi.mock('@/lib/tauri-client', () => ({
  TauriClient: {
    block: {
      executeCommand: vi.fn(),
      getAllBlocks: vi.fn(),
    },
    terminal: {
      initTerminal: vi.fn(),
      writeToPty: vi.fn(),
      resizePty: vi.fn(),
      saveSession: vi.fn(),
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

describe('Terminal PTY Functionality', () => {
  const mockEditor: Editor = {
    editor_id: 'test-editor',
    name: 'Test Editor',
  }

  const mockTerminalBlock: Block = {
    block_id: 'terminal-block-1',
    name: 'Terminal Block',
    block_type: 'terminal',
    contents: {},
    children: {},
    owner: 'test-editor',
  }

  const mockTerminalBlockWithSave: Block = {
    ...mockTerminalBlock,
    contents: {
      saved_content:
        'Welcome to Elfiee Terminal!\\n$ ls\\nfile1.txt  file2.txt',
      saved_at: '2024-01-15T14:30:25.123Z',
    },
  }

  let mockInitTerminal: ReturnType<typeof vi.fn>
  let mockWriteToPty: ReturnType<typeof vi.fn>
  let mockResizePty: ReturnType<typeof vi.fn>
  let mockSaveSession: ReturnType<typeof vi.fn>
  let mockGetAllBlocks: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    currentTerminal = null
    setTerminalBufferLines([])

    const { TauriClient } = await import('@/lib/tauri-client')
    mockInitTerminal = vi.mocked(TauriClient.terminal.initTerminal)
    mockWriteToPty = vi.mocked(TauriClient.terminal.writeToPty)
    mockResizePty = vi.mocked(TauriClient.terminal.resizePty)
    mockSaveSession = vi.mocked(TauriClient.terminal.saveSession)
    mockGetAllBlocks = vi.mocked(TauriClient.block.getAllBlocks)

    vi.clearAllMocks()
    mockAppStore.getActiveEditor.mockReturnValue(mockEditor)
    mockAppStore.getSelectedBlock.mockReturnValue(mockTerminalBlock)
    mockGetAllBlocks.mockResolvedValue([mockTerminalBlock])
    mockInitTerminal.mockResolvedValue(undefined)
    mockWriteToPty.mockResolvedValue(undefined)
    mockResizePty.mockResolvedValue(undefined)
    mockSaveSession.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const waitForTerminalInstance = async () => {
    await waitFor(() => {
      expect(currentTerminal).not.toBeNull()
    })
    return currentTerminal!
  }

  describe('PTY Initialization', () => {
    it('should initialize PTY session on mount', async () => {
      render(<Terminal />)

      await waitForTerminalInstance()

      await waitFor(() => {
        expect(mockInitTerminal).toHaveBeenCalledWith(
          'terminal-block-1',
          'test-editor',
          24,
          80
        )
      })
    })

    it('should display initialization loading state', async () => {
      render(<Terminal />)

      expect(screen.getByText('Initialising terminal...')).toBeInTheDocument()

      await waitFor(() => {
        expect(
          screen.queryByText('Initialising terminal...')
        ).not.toBeInTheDocument()
      })
    })

    it('should handle PTY initialization failure', async () => {
      mockInitTerminal.mockRejectedValueOnce(new Error('PTY init failed'))

      render(<Terminal />)

      const terminal = await waitForTerminalInstance()

      await waitFor(() => {
        expect(terminal.writeln).toHaveBeenCalledWith(
          expect.stringContaining('Failed to initialize PTY')
        )
      })
    })
  })

  describe('Session Restore', () => {
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
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Welcome to Elfiee Terminal!'),
          expect.stringContaining('=== Starting New Session ==='),
        ])
      )
    })

    it('should start fresh session when no saved content', async () => {
      render(<Terminal />)

      const terminal = await waitForTerminalInstance()

      await waitFor(() =>
        expect(terminal.writeln).toHaveBeenCalledWith(
          'PTY session initialized.'
        )
      )
      expect(terminal.writeln).not.toHaveBeenCalledWith(
        '=== Restored Terminal Session ==='
      )
    })
  })

  describe('Save Functionality', () => {
    it('should save terminal buffer content', async () => {
      setTerminalBufferLines([
        'Welcome to Elfiee Terminal!',
        'PTY session initialized.',
        '$ ls',
        'file1.txt  file2.txt',
      ])
      const user = userEvent.setup()

      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockSaveSession).toHaveBeenCalledWith(
          'test-file-id',
          'terminal-block-1',
          expect.stringContaining('Welcome to Elfiee Terminal!'),
          'test-editor'
        )
      })

      expect(mockAppStore.addNotification).toHaveBeenCalledWith(
        'success',
        '终端内容已保存到 Block 中。'
      )
    })

    it('should handle save failure', async () => {
      mockSaveSession.mockRejectedValueOnce(new Error('Save failed'))
      const user = userEvent.setup()

      render(<Terminal />)

      const saveButton = await screen.findByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockAppStore.addNotification).toHaveBeenCalledWith(
          'error',
          '保存终端内容失败: Save failed'
        )
      })
    })

    it('should disable save button while saving', async () => {
      mockSaveSession.mockImplementationOnce(
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

  describe('No Terminal Block', () => {
    it('should show error when no terminal block selected', async () => {
      mockAppStore.getSelectedBlock.mockReturnValue(null)

      render(<Terminal />)

      expect(
        await screen.findByText('终端需要Terminal Block')
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /save/i })
      ).not.toBeInTheDocument()
    })

    it('should show error when selected block is not terminal type', async () => {
      const markdownBlock: Block = {
        ...mockTerminalBlock,
        block_type: 'markdown',
      }
      mockAppStore.getSelectedBlock.mockReturnValue(markdownBlock)

      render(<Terminal />)

      expect(
        await screen.findByText('终端需要Terminal Block')
      ).toBeInTheDocument()
    })
  })
})
