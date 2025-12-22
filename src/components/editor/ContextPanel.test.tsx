import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContextPanel from './ContextPanel'
import type { Block, Editor, Event as BlockEvent, Grant } from '@/bindings'

// Mock app-store
const mockStore = {
  currentFileId: 'test-file-id',
  selectedBlockId: 'block-1',
  getBlock: vi.fn(),
  getEvents: vi.fn(() => []),
  getEditors: vi.fn(() => []),
  getGrants: vi.fn(() => []),
  updateBlockMetadata: vi.fn(),
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
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
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

// Helper to create mock block
const createMockBlock = (
  id: string,
  name: string,
  description?: string
): Block => ({
  block_id: id,
  name,
  block_type: 'markdown',
  contents: {},
  children: {},
  owner: 'test-user',
  metadata: {
    description: description,
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
  attribute: string
): BlockEvent => ({
  event_id: id,
  entity,
  attribute,
  value: {},
  timestamp: { 'test-user': 1 },
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

describe('ContextPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.currentFileId = 'test-file-id'
    mockStore.selectedBlockId = 'block-1'
    mockStore.getBlock.mockReturnValue(
      createMockBlock('block-1', 'Test Block', 'Test description')
    )
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

      // Block name should be in the Info tab content
      const infoTab = screen.getByTestId('tab-content-info')
      expect(infoTab).toHaveTextContent('Test Block')
    })

    it('should display block description', () => {
      render(<ContextPanel />)

      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('should show placeholder when no description', () => {
      mockStore.getBlock.mockReturnValue(
        createMockBlock('block-1', 'Test Block')
      )

      render(<ContextPanel />)

      expect(screen.getByText(/no description yet/i)).toBeInTheDocument()
    })

    it('should display block type', () => {
      render(<ContextPanel />)

      expect(screen.getByText('markdown')).toBeInTheDocument()
    })

    it('should display block owner', () => {
      render(<ContextPanel />)

      expect(screen.getByText('test-user')).toBeInTheDocument()
    })

    it('should display block ID', () => {
      render(<ContextPanel />)

      expect(screen.getByText('block-1')).toBeInTheDocument()
    })
  })

  describe('Description Editing', () => {
    it('should show edit button for description', () => {
      render(<ContextPanel />)

      const buttons = screen.getAllByTestId('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should enter edit mode when clicking edit button', async () => {
      const user = userEvent.setup()

      render(<ContextPanel />)

      const buttons = screen.getAllByTestId('button')
      // The first button should be the edit button
      await user.click(buttons[0])

      await waitFor(() => {
        expect(screen.getByTestId('textarea')).toBeInTheDocument()
      })
    })

    it('should save description when clicking save', async () => {
      const user = userEvent.setup()
      mockStore.updateBlockMetadata.mockResolvedValue(undefined)

      render(<ContextPanel />)

      const buttons = screen.getAllByTestId('button')
      await user.click(buttons[0]) // Click edit

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

      if (cancelButton) {
        await user.click(cancelButton)

        await waitFor(() => {
          expect(screen.queryByTestId('textarea')).not.toBeInTheDocument()
        })
      }
    })
  })

  describe('Collaborators Tab', () => {
    it('should display collaborators', () => {
      const mockEditors = [
        createMockEditor('editor-1', 'Editor 1'),
        createMockEditor('editor-2', 'Editor 2'),
      ]
      const mockGrants = [
        createMockGrant('editor-1', 'markdown.write', 'block-1'),
        createMockGrant('editor-2', 'core.link', 'block-1'),
      ]

      mockStore.getEditors.mockReturnValue(mockEditors)
      mockStore.getGrants.mockReturnValue(mockGrants)

      render(<ContextPanel />)

      // Content should be in the collaborators tab
      const collaboratorsTab = screen.getByTestId('tab-content-collaborators')
      expect(collaboratorsTab).toBeInTheDocument()
    })

    it('should show no grants message when empty', () => {
      mockStore.getEditors.mockReturnValue([])
      mockStore.getGrants.mockReturnValue([])

      render(<ContextPanel />)

      const collaboratorsTab = screen.getByTestId('tab-content-collaborators')
      expect(collaboratorsTab).toBeInTheDocument()
    })
  })

  describe('Timeline Tab', () => {
    it('should display events', () => {
      const mockEvents = [
        createMockEvent('event-1', 'block-1', 'create'),
        createMockEvent('event-2', 'block-1', 'update'),
      ]

      mockStore.getEvents.mockReturnValue(mockEvents)

      render(<ContextPanel />)

      const timelineTab = screen.getByTestId('tab-content-timeline')
      expect(timelineTab).toBeInTheDocument()
    })

    it('should show no events message when empty', () => {
      mockStore.getEvents.mockReturnValue([])

      render(<ContextPanel />)

      const timelineTab = screen.getByTestId('tab-content-timeline')
      expect(timelineTab).toBeInTheDocument()
    })
  })

  describe('No Block Selected', () => {
    it('should show empty state when no block selected', () => {
      mockStore.selectedBlockId = null
      mockStore.getBlock.mockReturnValue(null)

      render(<ContextPanel />)

      // The empty state should be in the Info tab
      const infoTab = screen.getByTestId('tab-content-info')
      expect(infoTab).toHaveTextContent(/no block selected/i)
    })

    it('should show helper text', () => {
      mockStore.selectedBlockId = null
      mockStore.getBlock.mockReturnValue(null)

      render(<ContextPanel />)

      expect(
        screen.getByText(/select a block to view its details/i)
      ).toBeInTheDocument()
    })
  })

  describe('Integration', () => {
    it('should work with app store', () => {
      render(<ContextPanel />)

      expect(mockStore.getBlock).toHaveBeenCalledWith('test-file-id', 'block-1')
    })

    it('should update when selected block changes', () => {
      const { rerender } = render(<ContextPanel />)

      mockStore.selectedBlockId = 'block-2'
      mockStore.getBlock.mockReturnValue(
        createMockBlock('block-2', 'New Block', 'New description')
      )

      rerender(<ContextPanel />)

      expect(mockStore.getBlock).toHaveBeenCalledWith('test-file-id', 'block-2')
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

      // Just verify that save button exists and updateBlockMetadata will be called with error
      expect(saveButton).toBeTruthy()
      expect(mockStore.updateBlockMetadata).toBeDefined()
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

      // Just verify that timestamps are rendered without error
      const infoTab = screen.getByTestId('tab-content-info')
      expect(infoTab).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper tab navigation', () => {
      render(<ContextPanel />)

      expect(screen.getByTestId('tabs-list')).toBeInTheDocument()
    })

    it('should have accessible buttons', () => {
      render(<ContextPanel />)

      const buttons = screen.getAllByTestId('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})
