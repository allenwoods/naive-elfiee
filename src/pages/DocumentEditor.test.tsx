import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DocumentEditor from './DocumentEditor'
import { useAppStore } from '@/lib/app-store'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock store
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

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
  const mockOpenFile = vi.fn()
  const mockSetCurrentFile = vi.fn()
  const mockLoadBlocks = vi.fn()
  const mockLoadEditors = vi.fn()
  const mockLoadGrants = vi.fn()
  const mockLoadEvents = vi.fn()
  const mockGetFileMetadata = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAppStore as any).mockImplementation((selector: any) =>
      selector({
        openFile: mockOpenFile,
        setCurrentFile: mockSetCurrentFile,
        loadBlocks: mockLoadBlocks,
        loadEditors: mockLoadEditors,
        loadGrants: mockLoadGrants,
        loadEvents: mockLoadEvents,
        getFileMetadata: mockGetFileMetadata,
        currentFileId: 'test-file-id',
        files: new Map(),
      })
    )
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

  it('should render loading state initially', () => {
    mockGetFileMetadata.mockReturnValue(null)
    renderWithRouter('test-project')
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should hide loading state after data loads', async () => {
    mockGetFileMetadata.mockReturnValue({ name: 'Test File', path: '/path' })
    renderWithRouter('test-project')

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })
  })

  it('should render all main components after loading', async () => {
    mockGetFileMetadata.mockReturnValue({ name: 'Test File', path: '/path' })
    renderWithRouter('test-project')

    await waitFor(() => {
      expect(screen.getByTestId('file-panel')).toBeInTheDocument()
      expect(screen.getByTestId('editor-canvas')).toBeInTheDocument()
      expect(screen.getByTestId('context-panel')).toBeInTheDocument()
    })
  })

  it('should initialize data on mount', async () => {
    mockGetFileMetadata.mockReturnValue({ name: 'Test File', path: '/path' })
    renderWithRouter('test-project')

    await waitFor(() => {
      expect(mockLoadBlocks).toHaveBeenCalled()
      expect(mockLoadEvents).toHaveBeenCalled()
    })
  })
})
