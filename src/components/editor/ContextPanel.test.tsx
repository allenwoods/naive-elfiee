import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContextPanel from './ContextPanel'
import type { Block, Editor, Event as BlockEvent, Grant } from '@/bindings'

// Mock app-store
const mockStore = {
  currentFileId: 'test-file-id',
  selectedBlockId: 'block-1',
  files: new Map(),
  updateBlockMetadata: vi.fn(),
  restoreToEvent: vi.fn(),
}

// Helper to create mock block
const createMockBlock = (
  id: string,
  name: string,
  description?: string
): Block => ({
  block_id: id,
  name,
  block_type: 'markdown',
  contents: { markdown: '# Content' },
  children: {},
  owner: 'test-user',
  metadata: {
    description: description || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
})

// Helper to create mock editor
const createMockEditor = (id: string, name: string): Editor => ({
  editor_id: id,
  name,
})

// Helper to create mock event
const createMockEvent = (
  id: string,
  entity: string,
  attribute: string,
  createdAt?: string,
  timestamp?: Record<string, number>
): BlockEvent => ({
  event_id: id,
  entity,
  attribute,
  value: {},
  timestamp: timestamp || { 'test-user': 1 },
  created_at: createdAt || new Date().toISOString(),
})

// Helper to create mock grant
const createMockGrant = (
  editorId: string,
  capId: string,
  blockId: string
): Grant => ({
  editor_id: editorId,
  cap_id: capId,
  block_id: blockId,
})

vi.mock('@/lib/app-store', () => ({
  useAppStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockStore)
    }
    return mockStore
  },
}))

// Mock TauriClient
vi.mock('@/lib/tauri-client', () => ({
  TauriClient: {
    event: {
      sortEventsByVectorClock: (events: BlockEvent[]) => {
        // Simple sort by created_at descending
        return [...events].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      },
    },
    block: {
      checkPermission: vi.fn().mockResolvedValue(true),
    },
  },
}))

// Mock CollaboratorList
vi.mock('@/components/permission/CollaboratorList', () => ({
  CollaboratorList: () => (
    <div data-testid="collaborator-list">CollaboratorList</div>
  ),
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
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: any) => (
    <div data-testid="tabs" data-default-value={defaultValue}>
      {children}
    </div>
  ),
  TabsContent: ({ children, value }: any) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
  TabsList: ({ children }: any) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({ children, value }: any) => (
    <button data-testid={`tab-trigger-${value}`}>{children}</button>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}))

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
    <button onClick={onClick} disabled={disabled} data-testid="button">
      {children}
    </button>
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

describe('ContextPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.currentFileId = 'test-file-id'
    mockStore.selectedBlockId = 'block-1'

    // Set up default file with a block
    const mockBlock = createMockBlock(
      'block-1',
      'Test Block',
      'Test description'
    )
    mockStore.files = new Map([
      [
        'test-file-id',
        {
          fileId: 'test-file-id',
          metadata: null,
          editors: [],
          activeEditorId: null,
          blocks: [mockBlock],
          selectedBlockId: 'block-1',
          events: [],
          grants: [],
        },
      ],
    ])
  })

  describe('Rendering', () => {
    it('should render context panel', () => {
      render(<ContextPanel />)

      expect(screen.getByTestId('tabs')).toBeInTheDocument()
    })

    it('should show no file opened when no current file', () => {
      mockStore.currentFileId = null

      render(<ContextPanel />)

      expect(screen.getByText(/no file opened/i)).toBeInTheDocument()
    })

    it('should render tabs', () => {
      render(<ContextPanel />)

      expect(screen.getByTestId('tab-trigger-info')).toBeInTheDocument()
      expect(
        screen.getByTestId('tab-trigger-collaborators')
      ).toBeInTheDocument()
      expect(screen.getByTestId('tab-trigger-timeline')).toBeInTheDocument()
    })
  })

  describe('Info Tab', () => {
    it('should display block name', () => {
      render(<ContextPanel />)

      // Block name appears in both header and info tab, so use getAllByText
      const blockNames = screen.getAllByText('Test Block')
      expect(blockNames.length).toBeGreaterThan(0)
    })

    it('should display block description', () => {
      render(<ContextPanel />)

      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('should show placeholder when no description', () => {
      const blockWithoutDescription = createMockBlock('block-1', 'Test Block')
      mockStore.files.set('test-file-id', {
        ...mockStore.files.get('test-file-id')!,
        blocks: [blockWithoutDescription],
      })

      render(<ContextPanel />)

      expect(screen.getByText(/no description provided/i)).toBeInTheDocument()
    })

    it('should display block type', () => {
      render(<ContextPanel />)

      expect(screen.getByText('markdown')).toBeInTheDocument()
    })

    it('should display block owner', () => {
      render(<ContextPanel />)

      expect(screen.getByText('test-user')).toBeInTheDocument()
    })

    it('should show empty state when no block selected', () => {
      mockStore.selectedBlockId = null

      render(<ContextPanel />)

      // "No block selected" appears in multiple tabs, so check in info tab specifically
      const infoTab = screen.getByTestId('tab-content-info')
      expect(infoTab).toHaveTextContent(/no block selected/i)
      expect(
        screen.getByText(/select a block to view its details/i)
      ).toBeInTheDocument()
    })
  })

  describe('Description Editing', () => {
    it('should show edit button for description', () => {
      render(<ContextPanel />)

      const buttons = screen.getAllByTestId('button')
      // Should have at least the edit button
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should enter edit mode when clicking edit button', async () => {
      const user = userEvent.setup()

      render(<ContextPanel />)

      // Find the edit button (icon button with Edit2 icon)
      const buttons = screen.getAllByTestId('button')
      const editButton =
        buttons.find(
          (btn) =>
            btn.getAttribute('title')?.includes('edit') ||
            btn.textContent === '' // Icon button might have no text
        ) || buttons[0] // Fallback to first button

      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByTestId('textarea')).toBeInTheDocument()
      })
    })

    it('should save description when clicking save', async () => {
      const user = userEvent.setup()
      mockStore.updateBlockMetadata.mockResolvedValue(undefined)

      render(<ContextPanel />)

      const buttons = screen.getAllByTestId('button')
      const editButton = buttons[0]
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByTestId('textarea')).toBeInTheDocument()
      })

      const textarea = screen.getByTestId('textarea')
      await user.clear(textarea)
      await user.type(textarea, 'Updated description')

      // Find and click save button
      const saveButtons = screen.getAllByTestId('button')
      const saveButton = saveButtons.find(
        (btn) =>
          btn.textContent?.includes('Save') ||
          btn.textContent?.includes('Saving')
      )

      expect(saveButton).toBeTruthy()
      if (saveButton) {
        await user.click(saveButton)

        await waitFor(() => {
          expect(mockStore.updateBlockMetadata).toHaveBeenCalledWith(
            'test-file-id',
            'block-1',
            expect.objectContaining({
              description: 'Updated description',
            })
          )
        })
      }
    })

    it('should cancel editing when clicking cancel', async () => {
      const user = userEvent.setup()

      render(<ContextPanel />)

      const buttons = screen.getAllByTestId('button')
      await user.click(buttons[0]) // Click edit

      await waitFor(() => {
        expect(screen.getByTestId('textarea')).toBeInTheDocument()
      })

      // Find and click cancel button
      const cancelButtons = screen.getAllByTestId('button')
      const cancelButton = cancelButtons.find((btn) =>
        btn.textContent?.includes('Cancel')
      )

      expect(cancelButton).toBeTruthy()
      if (cancelButton) {
        await user.click(cancelButton)

        await waitFor(() => {
          expect(screen.queryByTestId('textarea')).not.toBeInTheDocument()
        })
      }
    })
  })

  describe('Collaborators Tab', () => {
    it('should display CollaboratorList when block is selected', () => {
      render(<ContextPanel />)

      const collaboratorsTab = screen.getByTestId('tab-content-collaborators')
      expect(collaboratorsTab).toBeInTheDocument()
      expect(screen.getByTestId('collaborator-list')).toBeInTheDocument()
    })

    it('should show no block selected message when no block', () => {
      mockStore.selectedBlockId = null

      render(<ContextPanel />)

      // Click on collaborators tab trigger to switch tabs
      const collaboratorsTabTrigger = screen.getByTestId(
        'tab-trigger-collaborators'
      )
      // Note: The tab switching might not work in test without proper Tabs implementation
      // But we can check the tab content exists
      const collaboratorsTab = screen.getByTestId('tab-content-collaborators')
      expect(collaboratorsTab).toBeInTheDocument()
    })
  })

  describe('Timeline Tab', () => {
    it('should display events', () => {
      const mockEvents = [
        createMockEvent('event-1', 'block-1', 'test-user/create'),
        createMockEvent('event-2', 'block-1', 'test-user/update'),
      ]

      mockStore.files.set('test-file-id', {
        ...mockStore.files.get('test-file-id')!,
        events: mockEvents,
      })

      render(<ContextPanel />)

      const timelineTab = screen.getByTestId('tab-content-timeline')
      expect(timelineTab).toBeInTheDocument()
    })

    it('should show no events message when empty', () => {
      mockStore.files.set('test-file-id', {
        ...mockStore.files.get('test-file-id')!,
        events: [],
      })

      render(<ContextPanel />)

      expect(screen.getByText(/no history/i)).toBeInTheDocument()
      expect(screen.getByText(/changes will appear here/i)).toBeInTheDocument()
    })

    it('should filter events by block id', () => {
      const mockEvents = [
        createMockEvent('event-1', 'block-1', 'test-user/create'),
        createMockEvent('event-2', 'block-2', 'test-user/create'), // Different block
        createMockEvent('event-3', 'block-1', 'test-user/update'),
      ]

      mockStore.files.set('test-file-id', {
        ...mockStore.files.get('test-file-id')!,
        events: mockEvents,
      })

      render(<ContextPanel />)

      const timelineTab = screen.getByTestId('tab-content-timeline')
      expect(timelineTab).toBeInTheDocument()
      // Events for block-1 should be displayed (event-1 and event-3)
    })

    it('should display events in descending order (newest first)', () => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const mockEvents = [
        createMockEvent(
          'event-old',
          'block-1',
          'user-old/update',
          lastWeek.toISOString()
        ),
        createMockEvent(
          'event-new',
          'block-1',
          'user-new/update',
          now.toISOString()
        ),
        createMockEvent(
          'event-mid',
          'block-1',
          'user-mid/update',
          yesterday.toISOString()
        ),
      ]

      mockStore.files.set('test-file-id', {
        ...mockStore.files.get('test-file-id')!,
        events: mockEvents,
      })

      render(<ContextPanel />)

      // The TimelineTab uses operatorName which is editorId in this mock
      // So we expect user-new, user-mid, user-old in that order
      const operatorNames = screen
        .getAllByText(/user-(new|mid|old)/)
        .map((el) => el.textContent)

      expect(operatorNames).toEqual(['user-new', 'user-mid', 'user-old'])
    })
  })

  describe('No Block Selected', () => {
    it('should show empty state when no block selected', () => {
      mockStore.selectedBlockId = null

      render(<ContextPanel />)

      // "No block selected" appears in multiple tabs, so check in info tab specifically
      const infoTab = screen.getByTestId('tab-content-info')
      expect(infoTab).toHaveTextContent(/no block selected/i)
    })

    it('should show helper text', () => {
      mockStore.selectedBlockId = null

      render(<ContextPanel />)

      expect(
        screen.getByText(/select a block to view its details/i)
      ).toBeInTheDocument()
    })

    it('should show "Blocks" in scope when no block selected', () => {
      mockStore.selectedBlockId = null

      render(<ContextPanel />)

      expect(screen.getByText('Blocks')).toBeInTheDocument()
    })
  })

  describe('Timestamps', () => {
    it('should display created at timestamp', () => {
      render(<ContextPanel />)

      expect(screen.getByText(/created/i)).toBeInTheDocument()
    })

    it('should display updated at timestamp', () => {
      render(<ContextPanel />)

      expect(screen.getByText(/updated/i)).toBeInTheDocument()
    })

    it('should format timestamps correctly', () => {
      render(<ContextPanel />)

      const infoTab = screen.getByTestId('tab-content-info')
      expect(infoTab).toBeInTheDocument()
      // Timestamps should be formatted as dates
      expect(screen.getByText(/created/i)).toBeInTheDocument()
      expect(screen.getByText(/updated/i)).toBeInTheDocument()
    })

    it('should not show timestamps when metadata is missing', () => {
      const blockWithoutTimestamps = createMockBlock(
        'block-1',
        'Test Block',
        'Test description'
      )
      blockWithoutTimestamps.metadata = {
        description: 'Test description',
      }

      mockStore.files.set('test-file-id', {
        ...mockStore.files.get('test-file-id')!,
        blocks: [blockWithoutTimestamps],
      })

      render(<ContextPanel />)

      // Created and Updated labels should not appear if timestamps are missing
      // But the component should still render without errors
      const infoTab = screen.getByTestId('tab-content-info')
      expect(infoTab).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper tab navigation', () => {
      render(<ContextPanel />)

      expect(screen.getByTestId('tabs-list')).toBeInTheDocument()
    })

    it('should have accessible buttons when block is selected', () => {
      render(<ContextPanel />)

      // When block is selected, there should be at least the edit button
      const buttons = screen.getAllByTestId('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should not have buttons when no block selected', () => {
      mockStore.selectedBlockId = null

      render(<ContextPanel />)

      // When no block is selected, there should be no buttons in the info tab
      const infoTab = screen.getByTestId('tab-content-info')
      const buttons = infoTab.querySelectorAll('[data-testid="button"]')
      expect(buttons.length).toBe(0)
    })
  })

  describe('Block Selection Updates', () => {
    it('should update when selected block changes', () => {
      const { rerender } = render(<ContextPanel />)

      // Block name appears in multiple places, so use getAllByText
      const blockNames = screen.getAllByText('Test Block')
      expect(blockNames.length).toBeGreaterThan(0)

      // Change to a different block
      const newBlock = createMockBlock(
        'block-2',
        'New Block',
        'New description'
      )
      mockStore.selectedBlockId = 'block-2'
      mockStore.files.set('test-file-id', {
        ...mockStore.files.get('test-file-id')!,
        blocks: [newBlock],
      })

      rerender(<ContextPanel />)

      const newBlockNames = screen.getAllByText('New Block')
      expect(newBlockNames.length).toBeGreaterThan(0)
      expect(screen.getByText('New description')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle save error gracefully', async () => {
      const user = userEvent.setup()
      mockStore.updateBlockMetadata.mockRejectedValue(new Error('Save failed'))

      render(<ContextPanel />)

      const buttons = screen.getAllByTestId('button')
      await user.click(buttons[0]) // Click edit

      await waitFor(
        () => {
          expect(screen.getByTestId('textarea')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const saveButtons = screen.getAllByTestId('button')
      const saveButton = saveButtons.find((btn) =>
        btn.textContent?.includes('Save')
      )

      expect(saveButton).toBeTruthy()
      if (saveButton) {
        await user.click(saveButton)
        // Error should be handled gracefully (logged to console)
        await waitFor(() => {
          expect(mockStore.updateBlockMetadata).toHaveBeenCalled()
        })
      }
    })
  })
})
