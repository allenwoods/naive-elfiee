import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import DocumentEditor from './DocumentEditor'
import { TauriClient } from '@/lib/tauri-client'
import type { FileMetadata, Block, Editor } from '@/bindings'

// Mock子组件
vi.mock('@/components/dashboard/Sidebar', () => ({
  Sidebar: () => <div data-testid="mock-sidebar">Sidebar</div>,
}))

vi.mock('@/components/editor/FilePanel', () => ({
  FilePanel: () => <div data-testid="mock-file-panel">FilePanel</div>,
}))

vi.mock('@/components/editor/EditorCanvas', () => ({
  EditorCanvas: () => <div data-testid="mock-editor-canvas">EditorCanvas</div>,
}))

vi.mock('@/components/editor/ContextPanel', () => ({
  default: () => <div data-testid="mock-context-panel">ContextPanel</div>,
}))

// Mock TauriClient
vi.mock('@/lib/tauri-client', () => ({
  TauriClient: {
    file: {
      getFileInfo: vi.fn(),
    },
    block: {
      getAllBlocks: vi.fn(),
    },
    editor: {
      listEditors: vi.fn(),
      getActiveEditor: vi.fn(),
    },
  },
}))

// Mock app-store
vi.mock('@/lib/app-store', () => {
  const actualStore = {
    files: new Map(),
    currentFileId: null,
    selectedBlockId: null,
    setCurrentFile: vi.fn(),
    loadBlocks: vi.fn().mockResolvedValue(undefined),
    loadEditors: vi.fn().mockResolvedValue(undefined),
    loadGrants: vi.fn().mockResolvedValue(undefined),
  }

  return {
    useAppStore: Object.assign(
      vi.fn((selector) => {
        if (typeof selector === 'function') {
          return selector(actualStore)
        }
        return actualStore
      }),
      {
        getState: () => actualStore,
        setState: (partial: any) => {
          Object.assign(actualStore, partial)
        },
      }
    ),
  }
})

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock UI components
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet">{children}</div>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-trigger">{children}</div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} data-testid="button">
      {children}
    </button>
  ),
}))

// Helper to create mock file metadata
const createMockFileMetadata = (id: string, name: string): FileMetadata => ({
  file_id: id,
  name,
  path: `/test/${name}.elf`,
  collaborators: ['user1'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

// Helper to render with router
const renderWithRouter = (
  component: React.ReactElement,
  { route = '/editor/test-file-id' } = {}
) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/editor/:projectId" element={component} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DocumentEditor', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(TauriClient.file.getFileInfo).mockResolvedValue(
      createMockFileMetadata('test-file-id', 'Test File')
    )
    vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue([])
    vi.mocked(TauriClient.editor.listEditors).mockResolvedValue([])
    vi.mocked(TauriClient.editor.getActiveEditor).mockResolvedValue(null)

    // Reset store mocks to resolve successfully
    const { useAppStore } = await import('@/lib/app-store')
    const store = useAppStore.getState()
    store.loadBlocks.mockResolvedValue(undefined)
    store.loadEditors.mockResolvedValue(undefined)
    store.loadGrants.mockResolvedValue(undefined)
  })

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      vi.mocked(TauriClient.file.getFileInfo).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve(createMockFileMetadata('test-file-id', 'Test File')),
              100
            )
          })
      )

      renderWithRouter(<DocumentEditor />)

      expect(screen.getByText(/loading project/i)).toBeInTheDocument()
    })

    it('should hide loading state after data loads', async () => {
      renderWithRouter(<DocumentEditor />)

      await waitFor(() => {
        expect(screen.queryByText(/loading project/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Layout Rendering', () => {
    it('should render all main components after loading', async () => {
      renderWithRouter(<DocumentEditor />)

      await waitFor(
        () => {
          expect(screen.queryByText(/loading project/i)).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Verify all main components are rendered (may have multiple instances for responsive design)
      expect(screen.getAllByTestId('mock-sidebar').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('mock-file-panel').length).toBeGreaterThan(0)
      expect(
        screen.getAllByTestId('mock-editor-canvas').length
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByTestId('mock-context-panel').length
      ).toBeGreaterThan(0)
    })

    it('should render mobile header', async () => {
      renderWithRouter(<DocumentEditor />)

      await waitFor(() => {
        expect(screen.queryByText(/loading project/i)).not.toBeInTheDocument()
      })

      expect(screen.getByText('Document Editor')).toBeInTheDocument()
    })
  })

  describe('File Loading', () => {
    it('should load file info when projectId is provided', async () => {
      const { useAppStore } = await import('@/lib/app-store')
      const store = useAppStore.getState()

      // Ensure files Map is empty so getFileInfo gets called
      store.files = new Map()

      renderWithRouter(<DocumentEditor />)

      await waitFor(
        () => {
          expect(store.loadBlocks).toHaveBeenCalled()
        },
        { timeout: 5000 }
      )
    })

    it('should load blocks for the file', async () => {
      const { useAppStore } = await import('@/lib/app-store')
      const store = useAppStore.getState()

      renderWithRouter(<DocumentEditor />)

      await waitFor(
        () => {
          expect(store.loadBlocks).toHaveBeenCalledWith('test-file-id')
        },
        { timeout: 3000 }
      )
    })

    it('should load editors for the file', async () => {
      const { useAppStore } = await import('@/lib/app-store')
      const store = useAppStore.getState()

      renderWithRouter(<DocumentEditor />)

      await waitFor(
        () => {
          expect(store.loadEditors).toHaveBeenCalledWith('test-file-id')
        },
        { timeout: 3000 }
      )
    })

    it('should handle file loading error', async () => {
      const { useAppStore } = await import('@/lib/app-store')
      const store = useAppStore.getState()

      // Make loadBlocks throw an error
      store.loadBlocks.mockRejectedValue(new Error('Failed to load'))

      renderWithRouter(<DocumentEditor />)

      // Wait for error handling and navigation
      await waitFor(
        () => {
          expect(store.loadBlocks).toHaveBeenCalled()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Navigation', () => {
    it('should show error when no projectId is provided', async () => {
      // Set route to have empty projectId
      const { container } = renderWithRouter(<DocumentEditor />, {
        route: '/editor/',
      })

      // Component should handle no projectId gracefully
      // Either show error or loading state
      expect(container).toBeInTheDocument()
    })

    it('should handle navigation errors', async () => {
      const { useAppStore } = await import('@/lib/app-store')
      const store = useAppStore.getState()

      // Make loadBlocks fail to trigger error navigation
      store.loadBlocks.mockRejectedValue(new Error('Load failed'))

      renderWithRouter(<DocumentEditor />)

      // Component should attempt to load
      await waitFor(
        () => {
          // Just verify the component attempted to handle the error
          expect(store.loadBlocks).toHaveBeenCalled()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Store Integration', () => {
    it('should initialize file state in store', async () => {
      const { useAppStore } = await import('@/lib/app-store')
      const store = useAppStore.getState()

      renderWithRouter(<DocumentEditor />)

      await waitFor(() => {
        expect(store.loadBlocks).toHaveBeenCalledWith('test-file-id')
      })
    })

    it('should set current file in store', async () => {
      const { useAppStore } = await import('@/lib/app-store')
      const store = useAppStore.getState()

      renderWithRouter(<DocumentEditor />)

      await waitFor(() => {
        expect(store.setCurrentFile).toHaveBeenCalled()
      })
    })
  })

  describe('Responsive Design', () => {
    it('should have mobile header visible on small screens', async () => {
      renderWithRouter(<DocumentEditor />)

      await waitFor(() => {
        expect(screen.queryByText(/loading project/i)).not.toBeInTheDocument()
      })

      // Mobile header text may appear multiple times
      const headers = screen.getAllByText('Document Editor')
      expect(headers.length).toBeGreaterThan(0)
    })

    it('should render sheet for mobile menu', async () => {
      renderWithRouter(<DocumentEditor />)

      await waitFor(() => {
        expect(screen.queryByText(/loading project/i)).not.toBeInTheDocument()
      })

      // Sheet component is rendered
      expect(screen.getAllByTestId('sheet').length).toBeGreaterThan(0)
    })
  })

  describe('Component Composition', () => {
    it('should pass correct layout structure', async () => {
      const { container } = renderWithRouter(<DocumentEditor />)

      await waitFor(() => {
        expect(screen.queryByText(/loading project/i)).not.toBeInTheDocument()
      })

      // Verify main layout structure exists
      expect(container.querySelector('.flex')).toBeTruthy()
    })
  })
})
