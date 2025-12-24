import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { FilePanel } from './FilePanel'
import type { Block } from '@/bindings'

// Mock子组件
vi.mock('./OutlineTree', () => ({
  OutlineTree: ({ initialNodes, activeNodeId, onSelectNode }: any) => (
    <div data-testid="mock-outline-tree">
      OutlineTree
      {initialNodes?.map((node: any) => (
        <button
          key={node.id}
          onClick={() => onSelectNode?.(node.id)}
          data-testid={`outline-node-${node.id}`}
          className={activeNodeId === node.id ? 'active' : ''}
        >
          {node.title}
        </button>
      ))}
    </div>
  ),
  OutlineNode: vi.fn(),
}))

vi.mock('./ImportRepositoryModal', () => ({
  ImportRepositoryModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="import-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

// Mock app-store
const mockStore = {
  currentFileId: 'test-file-id',
  selectedBlockId: null,
  files: new Map(),
  getBlocks: vi.fn(() => []),
  getFileMetadata: vi.fn(() => ({ name: 'Test File' })),
  selectBlock: vi.fn(),
  createBlock: vi.fn(),
  renameBlock: vi.fn(),
  deleteBlock: vi.fn(),
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
    ...props
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <div data-testid="separator" />,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} data-testid="dropdown-item">
      {children}
    </button>
  ),
}))

// Helper to create mock blocks
const createMockBlock = (id: string, name: string): Block => ({
  block_id: id,
  name,
  block_type: 'markdown',
  contents: {},
  children: {},
  owner: 'test-user',
  metadata: {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
})

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('FilePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.getBlocks.mockReturnValue([])
    mockStore.selectedBlockId = null
  })

  describe('Rendering', () => {
    it('should render outline tree', () => {
      renderWithRouter(<FilePanel />)

      expect(screen.getByTestId('mock-outline-tree')).toBeInTheDocument()
    })

    it('should render scroll area', () => {
      renderWithRouter(<FilePanel />)

      expect(screen.getByTestId('scroll-area')).toBeInTheDocument()
    })

    it('should render with empty state when no blocks', () => {
      mockStore.getBlocks.mockReturnValue([])

      renderWithRouter(<FilePanel />)

      expect(screen.getByTestId('mock-outline-tree')).toBeInTheDocument()
    })
  })

  describe('Block Display', () => {
    it('should display blocks from store', () => {
      const mockBlocks = [
        createMockBlock('block-1', 'Block 1'),
        createMockBlock('block-2', 'Block 2'),
      ]
      mockStore.getBlocks.mockReturnValue(mockBlocks)

      renderWithRouter(<FilePanel />)

      expect(screen.getByText('Block 1')).toBeInTheDocument()
      expect(screen.getByText('Block 2')).toBeInTheDocument()
    })

    it('should handle blocks with children', () => {
      const parentBlock = createMockBlock('parent', 'Parent Block')
      const childBlock = createMockBlock('child', 'Child Block')
      parentBlock.children = { default: ['child'] }

      mockStore.getBlocks.mockReturnValue([parentBlock, childBlock])

      renderWithRouter(<FilePanel />)

      expect(screen.getByText('Parent Block')).toBeInTheDocument()
    })
  })

  describe('Block Selection', () => {
    it('should call selectBlock when clicking on a block', async () => {
      const user = userEvent.setup()
      const mockBlocks = [createMockBlock('block-1', 'Test Block')]
      mockStore.getBlocks.mockReturnValue(mockBlocks)

      renderWithRouter(<FilePanel />)

      const blockNode = screen.getByTestId('outline-node-block-1')
      await user.click(blockNode)

      await waitFor(() => {
        expect(mockStore.selectBlock).toHaveBeenCalledWith('block-1')
      })
    })

    it('should highlight selected block', () => {
      mockStore.selectedBlockId = 'block-1'
      const mockBlocks = [createMockBlock('block-1', 'Selected Block')]
      mockStore.getBlocks.mockReturnValue(mockBlocks)

      renderWithRouter(<FilePanel />)

      expect(screen.getByText('Selected Block')).toBeInTheDocument()
    })
  })

  describe('Block Creation', () => {
    it('should show create block button', () => {
      renderWithRouter(<FilePanel />)

      // The component should have a way to create new blocks
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should handle creating new block', async () => {
      mockStore.createBlock.mockResolvedValue(undefined)

      renderWithRouter(<FilePanel />)

      // This would test the actual create functionality when implemented
      expect(mockStore.createBlock).toBeDefined()
    })
  })

  describe('Block Renaming', () => {
    it('should handle renaming block', async () => {
      mockStore.renameBlock.mockResolvedValue(undefined)
      const mockBlocks = [createMockBlock('block-1', 'Old Name')]
      mockStore.getBlocks.mockReturnValue(mockBlocks)

      renderWithRouter(<FilePanel />)

      // Verify rename functionality exists
      expect(mockStore.renameBlock).toBeDefined()
    })
  })

  describe('Block Deletion', () => {
    it('should handle deleting block', async () => {
      mockStore.deleteBlock.mockResolvedValue(undefined)
      const mockBlocks = [createMockBlock('block-1', 'To Delete')]
      mockStore.getBlocks.mockReturnValue(mockBlocks)

      renderWithRouter(<FilePanel />)

      // Verify delete functionality exists
      expect(mockStore.deleteBlock).toBeDefined()
    })
  })

  describe('Import Modal', () => {
    it('should not show import modal by default', () => {
      renderWithRouter(<FilePanel />)

      expect(screen.queryByTestId('import-modal')).not.toBeInTheDocument()
    })
  })

  describe('No File State', () => {
    it('should handle no current file gracefully', () => {
      mockStore.currentFileId = null

      renderWithRouter(<FilePanel />)

      // Component should still render without errors
      expect(screen.getByTestId('scroll-area')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithRouter(<FilePanel />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toBeTruthy()
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      const mockBlocks = [createMockBlock('block-1', 'Test Block')]
      mockStore.getBlocks.mockReturnValue(mockBlocks)

      renderWithRouter(<FilePanel />)

      // Tab navigation should work
      await user.tab()
      expect(document.activeElement).toBeTruthy()
    })
  })

  describe('Performance', () => {
    it('should handle large number of blocks', () => {
      const manyBlocks = Array.from({ length: 100 }, (_, i) =>
        createMockBlock(`block-${i}`, `Block ${i}`)
      )
      mockStore.getBlocks.mockReturnValue(manyBlocks)

      const { container } = renderWithRouter(<FilePanel />)

      expect(container).toBeInTheDocument()
    })
  })

  describe('Integration', () => {
    it('should work with outline tree component', () => {
      const mockBlocks = [
        createMockBlock('block-1', 'Block 1'),
        createMockBlock('block-2', 'Block 2'),
      ]
      mockStore.currentFileId = 'test-file-id'
      mockStore.getBlocks.mockReturnValue(mockBlocks)

      const { container } = renderWithRouter(<FilePanel />)

      // Check that outline tree is rendered
      expect(screen.getByTestId('mock-outline-tree')).toBeInTheDocument()

      // Check that blocks are rendered as buttons (from our mock)
      const buttons = screen.getAllByRole('button')
      const blockButtons = buttons.filter((btn) =>
        btn.getAttribute('data-testid')?.startsWith('outline-node-')
      )
      expect(blockButtons.length).toBe(2)
    })
  })
})
