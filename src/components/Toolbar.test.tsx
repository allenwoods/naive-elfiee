/**
 * Toolbar Component Tests
 */

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toolbar } from './Toolbar'
import { useAppStore } from '@/lib/app-store'

// Mock the app store
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

// Mock the EditorSelector component
vi.mock('./EditorSelector', () => ({
  EditorSelector: () => (
    <div data-testid="editor-selector">Editor Selector</div>
  ),
}))

describe('Toolbar Component', () => {
  const mockStore = {
    activeFileId: null,
    createFile: vi.fn(),
    openFile: vi.fn(),
    saveFile: vi.fn(),
    closeFile: vi.fn(),
    isLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue(mockStore)
  })

  test('renders all file operation buttons', () => {
    render(<Toolbar />)

    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('buttons are not disabled when not loading and no active file', () => {
    render(<Toolbar />)

    const newButton = screen.getByRole('button', { name: /new/i })
    const openButton = screen.getByRole('button', { name: /open/i })
    const saveButton = screen.getByRole('button', { name: /save/i })
    const closeButton = screen.getByRole('button', { name: /close/i })

    expect(newButton).not.toBeDisabled()
    expect(openButton).not.toBeDisabled()
    expect(saveButton).toBeDisabled() // Save should be disabled when no active file
    expect(closeButton).toBeDisabled() // Close should be disabled when no active file
  })

  test('buttons are disabled when loading', () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      isLoading: true,
    })

    render(<Toolbar />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  test('save and close buttons are enabled when active file exists', () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      activeFileId: 'test-file-1',
    })

    render(<Toolbar />)

    const saveButton = screen.getByRole('button', { name: /save/i })
    const closeButton = screen.getByRole('button', { name: /close/i })

    expect(saveButton).not.toBeDisabled()
    expect(closeButton).not.toBeDisabled()
  })

  test('calls createFile when New button is clicked', async () => {
    const user = userEvent.setup()
    render(<Toolbar />)

    const newButton = screen.getByRole('button', { name: /new/i })
    await user.click(newButton)

    expect(mockStore.createFile).toHaveBeenCalledTimes(1)
  })

  test('calls openFile when Open button is clicked', async () => {
    const user = userEvent.setup()
    render(<Toolbar />)

    const openButton = screen.getByRole('button', { name: /open/i })
    await user.click(openButton)

    expect(mockStore.openFile).toHaveBeenCalledTimes(1)
  })

  test('calls saveFile when Save button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      activeFileId: 'test-file-1',
    })

    render(<Toolbar />)

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    expect(mockStore.saveFile).toHaveBeenCalledWith('test-file-1')
  })

  test('calls closeFile when Close button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      activeFileId: 'test-file-1',
    })

    render(<Toolbar />)

    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    expect(mockStore.closeFile).toHaveBeenCalledWith('test-file-1')
  })

  test('shows EditorSelector when active file exists', () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      activeFileId: 'test-file-1',
    })

    render(<Toolbar />)

    expect(screen.getByTestId('editor-selector')).toBeInTheDocument()
  })

  test('does not show EditorSelector when no active file', () => {
    render(<Toolbar />)

    expect(screen.queryByTestId('editor-selector')).not.toBeInTheDocument()
  })

  test('displays active file ID when file is open', () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      activeFileId: 'test-file-1',
    })

    render(<Toolbar />)

    expect(screen.getByText('File: test-file-1')).toBeInTheDocument()
  })

  test('does not display file ID when no file is open', () => {
    render(<Toolbar />)

    expect(screen.queryByText(/File:/)).not.toBeInTheDocument()
  })

  test('renders icons correctly', () => {
    render(<Toolbar />)

    // Check that icons are present (they should be SVG elements)
    const icons = screen
      .getAllByRole('button')
      .map((button) => button.querySelector('svg'))
    expect(icons.filter(Boolean)).toHaveLength(4) // New, Open, Save, Close icons
  })
})
