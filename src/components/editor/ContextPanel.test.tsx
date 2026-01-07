import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContextPanel from './ContextPanel'
import { useAppStore } from '@/lib/app-store'
import type { Block, Event } from '@/bindings'

describe('ContextPanel', () => {
  const mockFileId = 'test-file-id'
  const mockBlockId = 'test-block-id'

  const mockBlock: Block = {
    block_id: mockBlockId,
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
      entity: mockBlockId,
      attribute: 'test-user/markdown.write',
      value: {},
      timestamp: { 'test-user': 1 },
      created_at: '2025-12-17T03:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render nothing if no file is opened', async () => {
    ;(useAppStore as any).mockImplementation((selector: any) => {
      const state: any = {
        currentFileId: null,
        files: new Map(),
        getEditors: vi.fn().mockReturnValue([]),
        getActiveEditor: vi.fn().mockReturnValue(undefined),
      }
      return selector ? selector(state) : state
    })
    render(<ContextPanel />)
    expect(await screen.findByText(/No file opened/i)).toBeInTheDocument()
  })

  it('should render tabs', async () => {
    ;(useAppStore as any).mockImplementation((selector: any) => {
      const state: any = {
        currentFileId: mockFileId,
        selectedBlockId: mockBlockId,
        files: new Map([
          [mockFileId, { blocks: [mockBlock], events: mockEvents }],
        ]),
        getEditors: vi.fn().mockReturnValue([]),
        getActiveEditor: vi.fn().mockReturnValue(undefined),
      }
      return selector ? selector(state) : state
    })
    render(<ContextPanel />)
    expect(await screen.findByText(/Info/i)).toBeInTheDocument()
    expect(screen.getByText(/Collaborators/i)).toBeInTheDocument()
    expect(screen.getByText(/Timeline/i)).toBeInTheDocument()
  })

  it('should show placeholder when no events exist', async () => {
    const user = userEvent.setup()
    // DISCIPLINE: Hard-coded logic for the empty events case to avoid state drift
    ;(useAppStore as any).mockImplementation((selector: any) => {
      const state: any = {
        currentFileId: mockFileId,
        selectedBlockId: mockBlockId,
        files: new Map([
          [
            mockFileId,
            {
              blocks: [mockBlock],
              events: [], // NO EVENTS
              activeEditorId: 'test-user',
            },
          ],
        ]),
        getEditors: vi.fn().mockReturnValue([]),
        getActiveEditor: vi.fn().mockReturnValue(undefined),
      }
      return selector ? selector(state) : state
    })

    render(<ContextPanel />)

    // Use findByRole for better precision
    const tab = await screen.findByRole('tab', { name: /Timeline/i })
    await user.click(tab)

    // Wait for the tab content to switch and render "No History"
    await waitFor(
      () => {
        expect(screen.getByText(/No History/i)).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })
})
