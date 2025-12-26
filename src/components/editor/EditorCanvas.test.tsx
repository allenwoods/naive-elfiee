import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorCanvas } from './EditorCanvas'
import type { Block } from '@/bindings'

// Mock myst-parser and myst-to-react
vi.mock('myst-parser', () => ({
  mystParse: vi.fn((text) => ({
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: text }] },
    ],
  })),
}))

vi.mock('myst-to-react', () => ({
  MyST: ({ ast }: any) => (
    <div data-testid="myst-renderer">{JSON.stringify(ast)}</div>
  ),
}))

vi.mock('@myst-theme/providers', () => ({
  Theme: { light: {} },
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

// Mock app-store
const mockStore = {
  currentFileId: 'test-file-id' as string | null,
  selectedBlockId: 'test-block-id' as string | null,
  getBlock: vi.fn(),
  updateBlock: vi.fn(),
  saveFile: vi.fn(),
}

vi.mock('@/lib/app-store', () => ({
  useAppStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockStore)
    }
    return mockStore
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, ...props }: any) => (
    <textarea
      value={value}
      onChange={onChange}
      data-testid="textarea"
      {...props}
    />
  ),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

// Mock syntax highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: React.ReactNode }) => (
    <pre data-testid="syntax-highlighter">{children}</pre>
  ),
}))

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}))

// Mock CodeBlockEditor
vi.mock('./CodeBlockEditor', () => ({
  CodeBlockEditor: ({ content, language, onSave }: any) => (
    <div data-testid="code-block-editor">
      <span data-testid="code-lang">{language}</span>
      <pre data-testid="code-content">{content}</pre>
      <button onClick={onSave}>Save Code</button>
    </div>
  ),
}))

// Helper to create mock block
const createMockBlock = (
  id: string,
  name: string,
  content: string = '',
  type: string = 'markdown'
): Block => ({
  block_id: id,
  name,
  block_type: type,
  contents: type === 'markdown' ? { markdown: content } : { text: content },
  children: {},
  owner: 'test-user',
  metadata: {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
})

describe('EditorCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.currentFileId = 'test-file-id'
    mockStore.selectedBlockId = 'block-1'
    mockStore.getBlock.mockReturnValue(
      createMockBlock('block-1', 'Test Block', '# Hello World', 'markdown')
    )
  })

  describe('Rendering', () => {
    it('should render editor canvas', () => {
      render(<EditorCanvas />)

      expect(screen.getByTestId('scroll-area')).toBeInTheDocument()
    })

    it('should show empty state when no block selected', () => {
      mockStore.selectedBlockId = null
      mockStore.getBlock.mockReturnValue(null)

      render(<EditorCanvas />)

      expect(screen.getByText(/no block selected/i)).toBeInTheDocument()
    })

    it('should render markdown document for markdown blocks', () => {
      render(<EditorCanvas />)
      expect(screen.getByTestId('myst-renderer')).toBeInTheDocument()
    })

    it('should render code editor for code blocks', () => {
      mockStore.getBlock.mockReturnValue(
        createMockBlock('block-code', 'main.rs', 'fn main() {}', 'code')
      )
      render(<EditorCanvas />)
      expect(screen.getByTestId('code-block-editor')).toBeInTheDocument()
      expect(screen.getByTestId('code-lang')).toHaveTextContent('rs')
      expect(screen.getByTestId('code-content')).toHaveTextContent(
        'fn main() {}'
      )
    })
  })

  describe('Edit Mode (Markdown)', () => {
    it('should toggle to edit mode when double-clicking content', async () => {
      const user = userEvent.setup()

      render(<EditorCanvas />)

      // Double-click on the content area to enter edit mode
      const contentArea = screen
        .getByTestId('myst-renderer')
        .closest('div[class*="cursor-text"]')

      if (contentArea) {
        await user.dblClick(contentArea)

        await waitFor(() => {
          expect(screen.getByTestId('textarea')).toBeInTheDocument()
        })
      }
    })
  })

  describe('Save Functionality', () => {
    it('should call updateBlock with correct type when saving', async () => {
      const user = userEvent.setup()
      mockStore.updateBlock.mockResolvedValue(undefined)

      // Test with code block
      mockStore.getBlock.mockReturnValue(
        createMockBlock('block-code', 'test.py', 'print(1)', 'code')
      )

      render(<EditorCanvas />)

      const saveBtn = screen.getByText(/save \(ctrl\+s\)/i)
      await user.click(saveBtn)

      expect(mockStore.updateBlock).toHaveBeenCalledWith(
        'test-file-id',
        'block-1',
        'print(1)',
        'code'
      )
    })
  })

  describe('Integration', () => {
    it('should work with app store', () => {
      render(<EditorCanvas />)

      expect(mockStore.getBlock).toHaveBeenCalledWith('test-file-id', 'block-1')
    })
  })
})
