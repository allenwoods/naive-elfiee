import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { EditorCanvas } from './EditorCanvas'
import { useAppStore } from '@/lib/app-store'
import type { Block } from '@/bindings'

describe('EditorCanvas', () => {
  const mockCurrentFileId = 'test-file-id'
  const mockSelectedBlockId = 'test-block-id'
  const mockUpdateBlock = vi.fn()
  const mockSaveFile = vi.fn()
  const mockLoadEvents = vi.fn()
  const mockGetBlock = vi.fn()

  const mockBlock: Block = {
    block_id: mockSelectedBlockId,
    name: 'test.md',
    block_type: 'markdown',
    contents: { markdown: '# Hello World' },
    children: {},
    owner: 'test-user',
    metadata: {
      created_at: '2025-12-17T02:00:00Z',
      updated_at: '2025-12-17T03:00:00Z',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Discipline: All-inclusive local mock to ensure absolute predictability
    ;(useAppStore as any).mockImplementation((selector: any) => {
      const state = {
        currentFileId:
          (useAppStore as any)._selectedBlockId !== undefined
            ? (useAppStore as any)._currentFileId
            : mockCurrentFileId,
        selectedBlockId:
          (useAppStore as any)._selectedBlockId !== undefined
            ? (useAppStore as any)._selectedBlockId
            : mockSelectedBlockId,
        files: new Map([
          [
            mockCurrentFileId,
            {
              blocks: (useAppStore as any)._blocks || [mockBlock],
              activeEditorId: 'test-user',
            },
          ],
        ]),
        updateBlock: mockUpdateBlock,
        saveFile: mockSaveFile,
        loadEvents: mockLoadEvents,
        getBlock: mockGetBlock.mockReturnValue(mockBlock),
      }
      return selector ? selector(state) : state
    })

    delete (useAppStore as any)._blocks
    delete (useAppStore as any)._selectedBlockId
    delete (useAppStore as any)._currentFileId
  })

  describe('Rendering', () => {
    it('should render empty state when no block is selected', async () => {
      ;(useAppStore as any)._selectedBlockId = null
      render(<EditorCanvas />)
      expect(await screen.findByText(/No block selected/i)).toBeInTheDocument()
    })

    it('should render markdown content when markdown block is selected', async () => {
      render(<EditorCanvas />)
      // Myst parser renders asynchronously
      await waitFor(
        () => {
          expect(screen.getByText(/Hello World/i)).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })
  })

  describe('Save Functionality', () => {
    it('should show toast when save button is clicked', async () => {
      const { toast } = await import('sonner')
      const toastSpy = vi.spyOn(toast, 'success')

      render(<EditorCanvas />)

      const saveButton = await screen.findByText(/Save/i)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Ctrl+S'))
      })

      // Editor save button should NOT call updateBlock or saveFile
      expect(mockUpdateBlock).not.toHaveBeenCalled()
      expect(mockSaveFile).not.toHaveBeenCalled()
    })
  })
})
