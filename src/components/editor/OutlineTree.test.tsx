import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OutlineTree, OutlineNode } from './OutlineTree'

// Mock icons to avoid rendering issues
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down">v</span>,
  ChevronRight: () => <span data-testid="icon-chevron-right">{'>'}</span>,
  FileText: () => <span data-testid="icon-file-text">file</span>,
  Plus: () => <span data-testid="icon-plus">+</span>,
  MoreHorizontal: () => <span data-testid="icon-more">...</span>,
  Trash2: () => <span data-testid="icon-trash">del</span>,
  Pencil: () => <span data-testid="icon-pencil">edit</span>,
}))

// Mock UI components
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => (
    <div
      data-testid="dropdown-trigger"
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: (e: any) => void
  }) => (
    <button onClick={onClick} data-testid="dropdown-item">
      {children}
    </button>
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.join(' '),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('OutlineTree', () => {
  const mockOnSelectNode = vi.fn()
  const mockOnCreateNode = vi.fn()
  const mockOnRenameNode = vi.fn()
  const mockOnDeleteNode = vi.fn()

  const initialNodes: OutlineNode[] = [
    {
      id: 'root-1',
      title: 'Root Doc',
      isExpanded: true,
      children: [
        {
          id: 'child-1',
          title: 'Child Doc',
          children: [],
        },
      ],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders initial nodes', () => {
    render(
      <OutlineTree
        initialNodes={initialNodes}
        activeNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    )

    expect(screen.getByText('Root Doc')).toBeInTheDocument()
    expect(screen.getByText('Child Doc')).toBeInTheDocument()
  })

  it('handles add child document', async () => {
    const user = userEvent.setup()
    render(
      <OutlineTree
        initialNodes={initialNodes}
        activeNodeId={null}
        onSelectNode={mockOnSelectNode}
        onCreateNode={mockOnCreateNode}
      />
    )

    // Hover over Root Doc to reveal actions
    const rootNode = screen.getByText('Root Doc').closest('.group')
    expect(rootNode).toBeInTheDocument()

    // Find the "+" button (Add sub-document)
    // Note: In actual DOM it appears on hover, but in tests strictly rendering, it might be in DOM but invisible or just there.
    // We mocked the icon as <span data-testid="icon-plus">+</span>
    const plusButtons = screen.getAllByTitle('Add sub-document')
    const rootPlusBtn = plusButtons[0] // First one is for root-1

    await user.click(rootPlusBtn)

    // Should see "Untitled" input
    const input = screen.getByDisplayValue('Untitled')
    expect(input).toBeInTheDocument()

    // Type new name
    await user.clear(input)
    await user.type(input, 'New Sub Doc{enter}')

    // Should call onCreateNode with parentId and new name
    expect(mockOnCreateNode).toHaveBeenCalledWith('root-1', 'New Sub Doc')

    // Optimistic update: Input should disappear and new text should appear
    await waitFor(() => {
      expect(input).not.toBeInTheDocument()
      expect(screen.getByText('New Sub Doc')).toBeInTheDocument()
    })
  })

  it('preserves creating node when initialNodes updates (Async Sync Fix)', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <OutlineTree
        initialNodes={initialNodes}
        activeNodeId={null}
        onSelectNode={mockOnSelectNode}
        onCreateNode={mockOnCreateNode}
      />
    )

    // 1. Start creating a child
    const plusButtons = screen.getAllByTitle('Add sub-document')
    await user.click(plusButtons[0]) // Add to 'Root Doc'

    // 2. Type name and Confirm
    const input = screen.getByDisplayValue('Untitled')
    await user.clear(input)
    await user.type(input, 'Optimistic Node{enter}')

    // 3. Validation: onCreateNode called
    expect(mockOnCreateNode).toHaveBeenCalledWith('root-1', 'Optimistic Node')

    // 4. Validation: Optimistic node is visible
    await waitFor(() => {
      expect(screen.getByText('Optimistic Node')).toBeInTheDocument()
    })

    // 5. Simulate async backend update (initialNodes prop changes)
    // The new node is NOT yet in the backend response (simulating latency or partial update)
    const updatedNodes = [...initialNodes] // Same nodes, no new node yet

    rerender(
      <OutlineTree
        initialNodes={updatedNodes}
        activeNodeId={null}
        onSelectNode={mockOnSelectNode}
        onCreateNode={mockOnCreateNode}
      />
    )

    // 6. Validation: The optimistic node should STILL be visible due to our recursive find fix
    expect(screen.getByText('Optimistic Node')).toBeInTheDocument()
  })

  it('handles rename node', async () => {
    const user = userEvent.setup()
    render(
      <OutlineTree
        initialNodes={initialNodes}
        activeNodeId={null}
        onSelectNode={mockOnSelectNode}
        onRenameNode={mockOnRenameNode}
      />
    )

    // Find "More options" for Root Doc
    const moreButtons = screen.getAllByTitle('More options')

    // Click dropdown trigger
    // Since we mocked DropdownMenuTrigger to stopPropagation, we can click it
    await user.click(moreButtons[0])

    // Click "Rename" item
    const renameItems = screen.getAllByText('Rename')
    await user.click(renameItems[0])

    // Should see input with "Root Doc"
    const input = screen.getByDisplayValue('Root Doc')
    await user.clear(input)
    await user.type(input, 'Renamed Root{enter}')

    // Should call onRenameNode
    expect(mockOnRenameNode).toHaveBeenCalledWith('root-1', 'Renamed Root')

    // Optimistic update
    expect(screen.getByText('Renamed Root')).toBeInTheDocument()
  })

  it('handles delete node', async () => {
    const user = userEvent.setup()
    render(
      <OutlineTree
        initialNodes={initialNodes}
        activeNodeId={null}
        onSelectNode={mockOnSelectNode}
        onDeleteNode={mockOnDeleteNode}
      />
    )

    // Find "More options" for Root Doc
    const moreButtons = screen.getAllByTitle('More options')
    await user.click(moreButtons[0])

    // Click "Delete" item
    const deleteItems = screen.getAllByText('Delete')
    await user.click(deleteItems[0])

    // Should call onDeleteNode
    expect(mockOnDeleteNode).toHaveBeenCalledWith('root-1')

    // Optimistic update: Root Doc should disappear
    expect(screen.queryByText('Root Doc')).not.toBeInTheDocument()
  })
})
