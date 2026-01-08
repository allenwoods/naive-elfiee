import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'
import { BrowserRouter } from 'react-router-dom'
import { useAppStore } from '@/lib/app-store'

// Mock dependencies
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

vi.mock('@/lib/tauri-client', () => ({
  TauriClient: {
    file: {
      getSystemEditorId: vi.fn().mockResolvedValue('system-editor-id'),
    },
  },
}))

const mockEditors = [
  { editor_id: 'system-editor-id', name: 'Owner', editor_type: 'Human' },
  { editor_id: 'editor-1', name: 'Alice', editor_type: 'Human' },
  { editor_id: 'editor-2', name: 'Bob', editor_type: 'Human' },
]

describe('Sidebar', () => {
  const setActiveEditorMock = vi.fn()
  const deleteEditorMock = vi.fn()
  const getEditorsMock = vi.fn()
  const getActiveEditorMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn())

    // Default mock implementation (no file open)
    ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentFileId: null,
      getEditors: getEditorsMock,
      getActiveEditor: getActiveEditorMock,
      setActiveEditor: setActiveEditorMock,
      deleteEditor: deleteEditorMock,
    })
  })

  const renderSidebar = () => {
    return render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    )
  }

  it('renders navigation links', () => {
    renderSidebar()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/')
    expect(links[1]).toHaveAttribute('href', '/editor')
  })

  it('renders user switcher when file is open', async () => {
    const user = userEvent.setup()

    // Setup store for open file (Alice is active)
    ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentFileId: 'file-123',
      getEditors: () => mockEditors,
      getActiveEditor: () => mockEditors[1], // Alice
      setActiveEditor: setActiveEditorMock,
      deleteEditor: deleteEditorMock,
    })

    renderSidebar()

    // Find the avatar fallback (AL for Alice)
    const avatar = screen.getByText('AL')
    expect(avatar).toBeInTheDocument()

    // Click to open dropdown
    await user.click(avatar)

    // Check if editors are listed
    expect(screen.getByText('Switch User')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('calls setActiveEditor when user selected', async () => {
    const user = userEvent.setup()

    // Alice is active
    ;(useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentFileId: 'file-123',
      getEditors: () => mockEditors,
      getActiveEditor: () => mockEditors[1], // Alice
      setActiveEditor: setActiveEditorMock,
      deleteEditor: deleteEditorMock,
    })

    renderSidebar()

    // Open dropdown
    await user.click(screen.getByText('AL'))

    // Click Bob
    await user.click(screen.getByText('Bob'))

    expect(setActiveEditorMock).toHaveBeenCalledWith('file-123', 'editor-2')
  })

  it('does not render user switcher when no file is open', () => {
    // Default mock has currentFileId: null
    renderSidebar()

    // Should not find the Avatar
    expect(screen.queryByText('AL')).not.toBeInTheDocument()
    expect(screen.queryByText('Switch User')).not.toBeInTheDocument()
  })
})
