import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContextPanel from './ContextPanel'
import { useAppStore } from '@/lib/app-store'
import type { Block, Event } from '@/bindings'

// Mock useAppStore
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

// Mock components
vi.mock('@/components/permission/CollaboratorList', () => ({
  CollaboratorList: () => <div data-testid="collaborator-list">Collaborator List</div>,
}))

describe('ContextPanel', () => {
  const mockCurrentFileId = 'test-file-id'
  const mockSelectedBlockId = 'test-block-id'
  const mockBlock: Block = {
    block_id: mockSelectedBlockId,
    name: 'Test Block',
    block_type: 'markdown',
    contents: { markdown: 'test content' },
    children: {},
    owner: 'test-user',
    metadata: {
      created_at: '2025-12-17T02:00:00Z',
      updated_at: '2025-12-17T03:00:00Z',
    },
  }

  const mockEvents: Event[] = [
    {
      event_id: 'e1',
      entity: mockSelectedBlockId,
      attribute: 'test-user/markdown.write',
      value: {},
      timestamp: { 'test-user': 1 },
      created_at: '2025-12-17T03:00:00Z',
    },
  ]

  const mockGetBlock = vi.fn()
  const mockGetEvents = vi.fn()
  const mockUpdateBlockMetadata = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAppStore as any).mockImplementation((selector: any) =>
      selector({
        currentFileId: mockCurrentFileId,
        selectedBlockId: mockSelectedBlockId,
        getBlock: mockGetBlock,
        getEvents: mockGetEvents,
        updateBlockMetadata: mockUpdateBlockMetadata,
        files: new Map([[mockCurrentFileId, { activeEditorId: 'test-user' }]]),
      })
    )
    mockGetBlock.mockReturnValue(mockBlock)
    mockGetEvents.mockReturnValue(mockEvents)
  })

  it('should render nothing if no file is opened', () => {
    ;(useAppStore as any).mockImplementation((selector: any) =>
      selector({
        currentFileId: null,
        selectedBlockId: null,
        files: new Map(),
      })
    )
    render(<ContextPanel />)
    expect(screen.getByText('No file opened')).toBeInTheDocument()
  })

  it('should render tabs', () => {
    render(<ContextPanel />)
    expect(screen.getByText('Info')).toBeInTheDocument()
    expect(screen.getByText('Collaborators')).toBeInTheDocument()
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('should show block info by default', () => {
    render(<ContextPanel />)
    expect(screen.getByText(mockBlock.name)).toBeInTheDocument()
    expect(screen.getByText(mockBlock.owner)).toBeInTheDocument()
  })

  it('should switch to Timeline tab and show events', async () => {
    render(<ContextPanel />)
    
    const timelineTab = screen.getByText('Timeline')
    fireEvent.click(timelineTab)

    await waitFor(() => {
      expect(screen.getByText('test-user/markdown.write')).toBeInTheDocument()
    })
  })

  describe('Description Editing', () => {
    it('should enter edit mode when clicking edit button', async () => {
      render(<ContextPanel />)
      
      const editButton = screen.getByRole('button', { name: '' }) // The Edit2 icon button
      fireEvent.click(editButton)

      expect(screen.getByPlaceholderText('Add a description...')).toBeInTheDocument()
    })

    it('should save description when clicking save', async () => {
      render(<ContextPanel />)
      
      // Enter edit mode
      fireEvent.click(screen.getByRole('button', { name: '' }))
      
      const textarea = screen.getByPlaceholderText('Add a description...')
      fireEvent.change(textarea, { target: { value: 'New description' } })
      
      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockUpdateBlockMetadata).toHaveBeenCalledWith(
          mockCurrentFileId,
          mockSelectedBlockId,
          { description: 'New description' }
        )
      })
    })
  })

  describe('Timeline Tab', () => {
    it('should display events related to selected block', () => {
      render(<ContextPanel />)
      fireEvent.click(screen.getByText('Timeline'))
      
      expect(screen.getByText('test-user/markdown.write')).toBeInTheDocument()
    })

    it('should show placeholder when no events exist', () => {
      mockGetEvents.mockReturnValue([])
      render(<ContextPanel />)
      fireEvent.click(screen.getByText('Timeline'))
      
      expect(screen.getByText('No events yet.')).toBeInTheDocument()
    })
  })
})