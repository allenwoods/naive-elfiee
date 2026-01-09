import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DocumentEditor from './DocumentEditor'
import { useAppStore } from '@/lib/app-store'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock components to reduce complexity
vi.mock('@/components/editor/FilePanel', () => ({
  FilePanel: () => <div data-testid="file-panel">File Panel</div>,
}))
vi.mock('@/components/editor/EditorCanvas', () => ({
  EditorCanvas: () => <div data-testid="editor-canvas">Editor Canvas</div>,
}))
vi.mock('@/components/editor/ContextPanel', () => ({
  default: () => <div data-testid="context-panel">Context Panel</div>,
}))

describe('DocumentEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const store = useAppStore.getState()
    store.currentFileId = 'test-file-id'
    store.files = new Map()
  })

  const renderWithRouter = (projectId: string) => {
    return render(
      <MemoryRouter initialEntries={[`/editor/${projectId}`]}>
        <Routes>
          <Route path="/editor/:projectId" element={<DocumentEditor />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('should render main layout after initialization', async () => {
    const store = useAppStore.getState() as any
    store.getFileMetadata.mockReturnValue({ name: 'Test File', path: '/path' })

    renderWithRouter('test-project')

    // Check if the main components are rendered
    await waitFor(() => {
      expect(screen.getByTestId('file-panel')).toBeInTheDocument()
      expect(screen.getByTestId('editor-canvas')).toBeInTheDocument()
    })
  })

  it('should initialize data on mount', async () => {
    const store = useAppStore.getState() as any
    store.getFileMetadata.mockReturnValue({ name: 'Test File', path: '/path' })

    renderWithRouter('test-project')

    await waitFor(() => {
      expect(store.loadBlocks).toHaveBeenCalled()
      expect(store.loadEvents).toHaveBeenCalled()
    })
  })
})
