import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EditorCanvas } from './EditorCanvas'
import { useAppStore } from '@/lib/app-store'
import type { Block } from '@/bindings'

// Mock useAppStore
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

// Mock sub-components to focus on EditorCanvas logic
vi.mock('./CodeBlockEditor', () => ({
  CodeBlockEditor: () => <div data-testid="code-editor">Code Editor</div>,
}))

describe('EditorCanvas', () => {
  const mockUpdateBlock = vi.fn()
  const mockSaveFile = vi.fn()
  const mockLoadEvents = vi.fn()
  const mockCurrentFileId = 'test-file-id'
  const mockSelectedBlockId = 'test-block-id'

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
    ;(useAppStore as any).mockImplementation((selector: any) =>
      selector({
        currentFileId: mockCurrentFileId,
        selectedBlockId: mockSelectedBlockId,
        updateBlock: mockUpdateBlock,
        saveFile: mockSaveFile,
        loadEvents: mockLoadEvents,
        files: new Map([
          [
            mockCurrentFileId,
            {
              blocks: [mockBlock],
              activeEditorId: 'test-user',
            },
          ],
        ]),
      })
    )
  })

  describe('Rendering', () => {
    it('should render empty state when no block is selected', () => {
      ;(useAppStore as any).mockImplementation((selector: any) =>
        selector({
          currentFileId: mockCurrentFileId,
          selectedBlockId: null,
          files: new Map(),
        })
      )
      render(<EditorCanvas />)
      expect(screen.getByText('No block selected')).toBeInTheDocument()
    })

    it('should render markdown content when markdown block is selected', () => {
      render(<EditorCanvas />)
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })

    it('should render code editor when code block is selected', () => {
      const codeBlock = { ...mockBlock, block_type: 'code', name: 'script.py' }
      ;(useAppStore as any).mockImplementation((selector: any) =>
        selector({
          currentFileId: mockCurrentFileId,
          selectedBlockId: mockSelectedBlockId,
          files: new Map([
            [
              mockCurrentFileId,
              {
                blocks: [codeBlock],
                activeEditorId: 'test-user',
              },
            ],
          ]),
        })
      )
      render(<EditorCanvas />)
      expect(screen.getByTestId('code-editor')).toBeInTheDocument()
    })
  })

  describe('Save Functionality', () => {
    it('should call updateBlock and saveFile when save button is clicked', async () => {
      // Mock permission check to pass
      const { TauriClient } = await import('@/lib/tauri-client')
      vi.spyOn(TauriClient.block, 'checkPermission').mockResolvedValue(true)

      render(<EditorCanvas />)
      
      const saveButton = screen.getByText(/Save/)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockUpdateBlock).toHaveBeenCalled()
        expect(mockSaveFile).toHaveBeenCalledWith(mockCurrentFileId)
        expect(mockLoadEvents).toHaveBeenCalledWith(mockCurrentFileId)
      })
    })
  })
})

// Helper for fireEvent
import { fireEvent } from '@testing-library/react'