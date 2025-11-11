/**
 * BlockList Component Tests
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockList } from './BlockList'
import { useAppStore } from '@/lib/app-store'
import type { Block } from '@/bindings'
import { createMockBlock } from '@/test/setup'

// Mock the app store
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

// Mock the message dialog - no longer needed

describe('BlockList Component', () => {
  const mockBlocks: Block[] = [
    createMockBlock({
      block_id: 'block-1',
      name: 'Block 1',
      block_type: 'markdown',
      contents: 'Test content' as any, // String contents for testing
    }),
    createMockBlock({
      block_id: 'block-2',
      name: 'Block 2',
      block_type: 'code',
      contents: { type: 'text', data: 'console.log("hello")' },
    }),
    createMockBlock({
      block_id: 'block-3',
      name: 'Block 3',
      block_type: 'diagram',
      children: { child: ['child-1', 'child-2'] },
    }),
  ]

  const mockStore = {
    activeFileId: 'test-file-1',
    getActiveFile: vi.fn(),
    getBlocks: vi.fn(),
    getEditors: vi.fn(),
    createBlock: vi.fn(),
    deleteBlock: vi.fn(),
    selectBlock: vi.fn(),
    getSelectedBlock: vi.fn(),
    getEditorName: vi.fn(),
    getBlockLinks: vi.fn(),
    isLoading: false,
    addNotification: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue(mockStore)
    vi.mocked(mockStore.getActiveFile).mockReturnValue({
      fileId: 'test-file-1',
      blocks: mockBlocks,
      selectedBlockId: null,
      editors: [],
      activeEditorId: null,
    })
    vi.mocked(mockStore.getBlocks).mockReturnValue(mockBlocks)
    vi.mocked(mockStore.getEditors).mockReturnValue([])
    vi.mocked(mockStore.getSelectedBlock).mockReturnValue(null)
    vi.mocked(mockStore.getEditorName).mockReturnValue('Test Editor')
    vi.mocked(mockStore.getBlockLinks).mockReturnValue([])
  })

  test('shows message when no file is open', () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      activeFileId: null,
    })
    vi.mocked(mockStore.getActiveFile).mockReturnValue(null)

    render(<BlockList />)

    expect(
      screen.getByText('No file opened. Create or open a file to get started.')
    ).toBeInTheDocument()
  })

  test('renders blocks header and create button', () => {
    render(<BlockList />)

    expect(screen.getByText('Blocks')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /new block/i })
    ).toBeInTheDocument()
  })

  test('shows empty state when no blocks exist', () => {
    vi.mocked(mockStore.getActiveFile).mockReturnValue({
      fileId: 'test-file-1',
      blocks: [],
      selectedBlockId: null,
      editors: [],
      activeEditorId: null,
    })

    render(<BlockList />)

    expect(
      screen.getByText('No blocks yet. Create your first block!')
    ).toBeInTheDocument()
  })

  test('renders all blocks in the list', () => {
    render(<BlockList />)

    expect(screen.getByText('Block 1')).toBeInTheDocument()
    expect(screen.getByText('Block 2')).toBeInTheDocument()
    expect(screen.getByText('Block 3')).toBeInTheDocument()
  })

  test('displays block information correctly', () => {
    render(<BlockList />)

    // Check block names
    expect(screen.getByText('Block 1')).toBeInTheDocument()
    expect(screen.getByText('Block 2')).toBeInTheDocument()

    // Check block types
    expect(screen.getByText('Type: markdown')).toBeInTheDocument()
    expect(screen.getByText('Type: code')).toBeInTheDocument()
    expect(screen.getByText('Type: diagram')).toBeInTheDocument()
  })

  test('displays block contents correctly', () => {
    render(<BlockList />)

    // String contents
    expect(screen.getByText('Test content')).toBeInTheDocument()

    // Object contents (JSON stringified)
    expect(
      screen.getByText('{"type":"text","data":"console.log(\\"hello\\")"}')
    ).toBeInTheDocument()
  })

  test('shows children count when block has children', () => {
    render(<BlockList />)

    expect(screen.getByText('Children: 2')).toBeInTheDocument()
  })

  test('highlights selected block', () => {
    vi.mocked(mockStore.getSelectedBlock).mockReturnValue(mockBlocks[0])

    render(<BlockList />)

    // Find the outer div with cursor-pointer class (the clickable block container)
    const selectedBlock = screen.getByText('Block 1').closest('.cursor-pointer')
    expect(selectedBlock).toHaveClass('bg-accent', 'border-primary')
  })

  test('calls selectBlock when block is clicked', async () => {
    const user = userEvent.setup()
    render(<BlockList />)

    const blockElement = screen.getByText('Block 1').closest('div')
    await user.click(blockElement!)

    expect(mockStore.selectBlock).toHaveBeenCalledWith('test-file-1', 'block-1')
  })

  test('calls deleteBlock when delete button is clicked', async () => {
    const user = userEvent.setup()
    render(<BlockList />)

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])

    expect(mockStore.deleteBlock).toHaveBeenCalledWith('test-file-1', 'block-1')
  })

  test('prevents event propagation when delete button is clicked', async () => {
    const user = userEvent.setup()
    render(<BlockList />)

    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0]

    // Click delete button
    await user.click(deleteButton)

    // selectBlock should not be called because event propagation was stopped
    expect(mockStore.selectBlock).not.toHaveBeenCalled()
  })

  test('shows block creation dialog and creates markdown block with custom name', async () => {
    const user = userEvent.setup()
    vi.mocked(mockStore.createBlock).mockResolvedValue(undefined)

    render(<BlockList />)

    await user.click(screen.getByRole('button', { name: /new block/i }))

    expect(
      screen.getByRole('heading', { name: 'Create New Block' })
    ).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Enter block name'), 'My Notes')
    await user.click(screen.getByText('Markdown'))
    await user.click(screen.getByRole('button', { name: 'Create Block' }))

    expect(mockStore.createBlock).toHaveBeenCalledWith(
      'test-file-1',
      'My Notes',
      'markdown'
    )
    expect(mockStore.addNotification).toHaveBeenCalledWith(
      'success',
      'Markdown block created successfully!'
    )
  })

  test('creates terminal block with custom name', async () => {
    const user = userEvent.setup()
    vi.mocked(mockStore.createBlock).mockResolvedValue(undefined)

    render(<BlockList />)

    await user.click(screen.getByRole('button', { name: /new block/i }))
    await user.type(screen.getByPlaceholderText('Enter block name'), 'Build Shell')
    await user.click(screen.getByText('Terminal'))
    await user.click(screen.getByRole('button', { name: 'Create Block' }))

    expect(mockStore.createBlock).toHaveBeenCalledWith(
      'test-file-1',
      'Build Shell',
      'terminal'
    )
    expect(mockStore.addNotification).toHaveBeenCalledWith(
      'success',
      'Terminal block created successfully!'
    )
  })

  test('shows error notification when block creation fails', async () => {
    const user = userEvent.setup()
    const error = new Error('Creation failed')
    vi.mocked(mockStore.createBlock).mockRejectedValue(error)

    render(<BlockList />)

    await user.click(screen.getByRole('button', { name: /new block/i }))
    await user.type(screen.getByPlaceholderText('Enter block name'), 'Broken')
    await user.click(screen.getByText('Markdown'))
    await user.click(screen.getByRole('button', { name: 'Create Block' }))

    expect(mockStore.addNotification).toHaveBeenCalledWith(
      'error',
      'Failed to create block: Error: Creation failed'
    )
  })

  test('disables create button in dialog when loading', async () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      isLoading: true,
    })

    render(<BlockList />)

    const createButton = screen.getByRole('button', { name: /new block/i })
    expect(createButton).toBeDisabled()
  })

  test('does not create block when no active file', async () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      activeFileId: null,
    })
    vi.mocked(mockStore.getActiveFile).mockReturnValue(null)

    render(<BlockList />)

    // Should show the "no file" message instead of create button
    expect(
      screen.queryByRole('button', { name: /new block/i })
    ).not.toBeInTheDocument()
  })

  test('handles empty block contents gracefully', () => {
    const blocksWithEmptyContents = [
      createMockBlock({
        block_id: 'empty-1',
        name: 'Empty String Block',
        contents: '' as any,
      }),
      createMockBlock({
        block_id: 'empty-2',
        name: 'Null Block',
        contents: null as any,
      }),
      createMockBlock({
        block_id: 'empty-3',
        name: 'Empty Object Block',
        contents: {} as any,
      }),
    ]

    vi.mocked(mockStore.getActiveFile).mockReturnValue({
      fileId: 'test-file-1',
      blocks: blocksWithEmptyContents,
      selectedBlockId: null,
      editors: [],
      activeEditorId: null,
    })
    vi.mocked(mockStore.getBlocks).mockReturnValue(blocksWithEmptyContents)

    render(<BlockList />)

    // Only null contents shows '(empty)'
    expect(screen.getByText('(empty)')).toBeInTheDocument()
    // Empty object shows '{}'
    expect(screen.getByText('{}')).toBeInTheDocument()
    // All three blocks should render with their names
    expect(screen.getByText('Empty String Block')).toBeInTheDocument()
    expect(screen.getByText('Null Block')).toBeInTheDocument()
    expect(screen.getByText('Empty Object Block')).toBeInTheDocument()
  })

  test('handles blocks with complex children structure', () => {
    const blockWithComplexChildren = createMockBlock({
      block_id: 'complex-block',
      children: {
        parent: ['child-1', 'child-2'],
        sibling: ['child-3'],
        uncle: [],
      },
    })

    vi.mocked(mockStore.getActiveFile).mockReturnValue({
      fileId: 'test-file-1',
      blocks: [blockWithComplexChildren],
      selectedBlockId: null,
      editors: [],
      activeEditorId: null,
    })

    render(<BlockList />)

    // Should show total children count (3)
    expect(screen.getByText('Children: 3')).toBeInTheDocument()
  })

})
