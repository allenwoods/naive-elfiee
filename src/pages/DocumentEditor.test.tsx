import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DocumentEditor from './DocumentEditor'
import { TauriClient } from '@/lib/tauri-client'
import type { FileMetadata } from '@/bindings'

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
      saveFile: vi.fn(),
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
const actualStore = {
  files: new Map(),
  currentFileId: null,
  selectedBlockId: null,
  setCurrentFile: vi.fn(),
  loadBlocks: vi.fn() as any,
  loadEditors: vi.fn() as any,
  loadGrants: vi.fn() as any,
  ensureSystemOutline: vi.fn() as any,
}

vi.mock('@/lib/app-store', () => {
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
    vi.mocked(TauriClient.editor.getActiveEditor).mockResolvedValue({
      status: 'ok',
      data: null,
    } as any)

    // Reset store mocks
    actualStore.loadBlocks.mockResolvedValue(undefined)
    actualStore.loadEditors.mockResolvedValue(undefined)
    actualStore.loadGrants.mockResolvedValue(undefined)
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

      // Verify all main components are rendered
      expect(screen.getAllByTestId('mock-sidebar').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('mock-file-panel').length).toBeGreaterThan(0)
      expect(
        screen.getAllByTestId('mock-editor-canvas').length
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByTestId('mock-context-panel').length
      ).toBeGreaterThan(0)
    })
  })

  describe('File Loading', () => {
    it('should load file info when projectId is provided', async () => {
      // Ensure files Map is empty so getFileInfo gets called
      actualStore.files = new Map()

      renderWithRouter(<DocumentEditor />)

      await waitFor(
        () => {
          expect(actualStore.loadBlocks).toHaveBeenCalled()
        },
        { timeout: 5000 }
      )
    })

    it('should load blocks for the file', async () => {
      renderWithRouter(<DocumentEditor />)

      await waitFor(
        () => {
          expect(actualStore.loadBlocks).toHaveBeenCalledWith('test-file-id')
        },
        { timeout: 3000 }
      )
    })

    it('should load editors for the file', async () => {
      renderWithRouter(<DocumentEditor />)

      await waitFor(
        () => {
          expect(actualStore.loadEditors).toHaveBeenCalledWith('test-file-id')
        },
        { timeout: 3000 }
      )
    })

    it('should handle file loading error', async () => {
      // Make loadBlocks throw an error
      actualStore.loadBlocks.mockRejectedValue(new Error('Failed to load'))

      renderWithRouter(<DocumentEditor />)

      // Wait for error handling
      await waitFor(
        () => {
          expect(actualStore.loadBlocks).toHaveBeenCalled()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Store Integration', () => {
    it('should initialize file state in store', async () => {
      renderWithRouter(<DocumentEditor />)

      await waitFor(() => {
        expect(actualStore.loadBlocks).toHaveBeenCalledWith('test-file-id')
      })
    })

    it('should set current file in store', async () => {
      renderWithRouter(<DocumentEditor />)

      await waitFor(() => {
        expect(actualStore.setCurrentFile).toHaveBeenCalled()
      })
    })
  })
})
