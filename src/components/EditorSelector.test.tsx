/**
 * EditorSelector Component Tests
 */

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorSelector } from './EditorSelector'
import { useAppStore } from '@/lib/app-store'
import type { Editor } from '@/bindings'

// Mock the app store
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

describe('EditorSelector Component', () => {
  const mockEditors: Editor[] = [
    { editor_id: 'editor-1', name: 'Editor 1' },
    { editor_id: 'editor-2', name: 'Editor 2' },
  ]

  const mockStore = {
    activeFileId: 'test-file-1',
    getEditors: vi.fn(),
    getActiveEditor: vi.fn(),
    createEditor: vi.fn(),
    setActiveEditor: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue(mockStore)
    vi.mocked(mockStore.getEditors).mockReturnValue(mockEditors)
    vi.mocked(mockStore.getActiveEditor).mockReturnValue(mockEditors[0])
  })

  test('renders nothing when no active file', () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      activeFileId: null,
    })
    
    const { container } = render(<EditorSelector />)
    expect(container.firstChild).toBeNull()
  })

  test('renders editor dropdown with all editors', () => {
    render(<EditorSelector />)
    
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Editor 1')
    expect(options[1]).toHaveTextContent('Editor 2')
  })

  test('shows "No editors" option when no editors exist', () => {
    vi.mocked(mockStore.getEditors).mockReturnValue([])
    
    render(<EditorSelector />)
    
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('No editors')).toBeInTheDocument()
  })

  test('selects active editor by default', () => {
    render(<EditorSelector />)
    
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('editor-1')
  })

  test('calls setActiveEditor when different editor is selected', async () => {
    const user = userEvent.setup()
    render(<EditorSelector />)
    
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'editor-2')
    
    expect(mockStore.setActiveEditor).toHaveBeenCalledWith('test-file-1', 'editor-2')
  })

  test('shows create editor button when not creating', () => {
    render(<EditorSelector />)
    
    const createButton = screen.getByRole('button', { name: /new editor/i })
    expect(createButton).toBeInTheDocument()
  })

  test('shows input form when creating new editor', async () => {
    const user = userEvent.setup()
    render(<EditorSelector />)
    
    const createButton = screen.getByRole('button', { name: /new editor/i })
    await user.click(createButton)
    
    expect(screen.getByPlaceholderText('Editor name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  test('creates new editor when form is submitted', async () => {
    const user = userEvent.setup()
    render(<EditorSelector />)
    
    // Start creating
    const createButton = screen.getByRole('button', { name: /new editor/i })
    await user.click(createButton)
    
    // Fill form and submit
    const input = screen.getByPlaceholderText('Editor name')
    await user.type(input, 'New Editor')
    
    const submitButton = screen.getByRole('button', { name: /create/i })
    await user.click(submitButton)
    
    expect(mockStore.createEditor).toHaveBeenCalledWith('test-file-1', 'New Editor')
  })

  test('cancels editor creation when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<EditorSelector />)
    
    // Start creating
    const createButton = screen.getByRole('button', { name: /new editor/i })
    await user.click(createButton)
    
    // Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)
    
    // Should be back to create button
    expect(screen.getByRole('button', { name: /new editor/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Editor name')).not.toBeInTheDocument()
  })

  test('creates editor when Enter key is pressed', async () => {
    const user = userEvent.setup()
    render(<EditorSelector />)
    
    // Start creating
    const createButton = screen.getByRole('button', { name: /new editor/i })
    await user.click(createButton)
    
    // Type and press Enter
    const input = screen.getByPlaceholderText('Editor name')
    await user.type(input, 'New Editor')
    await user.keyboard('{Enter}')
    
    expect(mockStore.createEditor).toHaveBeenCalledWith('test-file-1', 'New Editor')
  })

  test('cancels editor creation when Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(<EditorSelector />)
    
    // Start creating
    const createButton = screen.getByRole('button', { name: /new editor/i })
    await user.click(createButton)
    
    // Press Escape
    await user.keyboard('{Escape}')
    
    // Should be back to create button
    expect(screen.getByRole('button', { name: /new editor/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Editor name')).not.toBeInTheDocument()
  })

  test('does not create editor with empty name', async () => {
    const user = userEvent.setup()
    render(<EditorSelector />)
    
    // Start creating
    const createButton = screen.getByRole('button', { name: /new editor/i })
    await user.click(createButton)
    
    // Try to submit with empty name
    const submitButton = screen.getByRole('button', { name: /create/i })
    await user.click(submitButton)
    
    expect(mockStore.createEditor).not.toHaveBeenCalled()
  })

  test('trims whitespace from editor name', async () => {
    const user = userEvent.setup()
    render(<EditorSelector />)
    
    // Start creating
    const createButton = screen.getByRole('button', { name: /new editor/i })
    await user.click(createButton)
    
    // Type with whitespace
    const input = screen.getByPlaceholderText('Editor name')
    await user.type(input, '  New Editor  ')
    
    const submitButton = screen.getByRole('button', { name: /create/i })
    await user.click(submitButton)
    
    expect(mockStore.createEditor).toHaveBeenCalledWith('test-file-1', 'New Editor')
  })

  test('clears input after successful creation', async () => {
    const user = userEvent.setup()
    vi.mocked(mockStore.createEditor).mockResolvedValue(undefined)
    
    render(<EditorSelector />)
    
    // Start creating
    const createButton = screen.getByRole('button', { name: /new editor/i })
    await user.click(createButton)
    
    // Fill and submit
    const input = screen.getByPlaceholderText('Editor name')
    await user.type(input, 'New Editor')
    
    const submitButton = screen.getByRole('button', { name: /create/i })
    await user.click(submitButton)
    
    // Should be back to create button (form cleared)
    expect(screen.getByRole('button', { name: /new editor/i })).toBeInTheDocument()
  })

  test('handles creation errors gracefully', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(mockStore.createEditor).mockRejectedValue(new Error('Creation failed'))
    
    render(<EditorSelector />)
    
    // Start creating
    const createButton = screen.getByRole('button', { name: /new editor/i })
    await user.click(createButton)
    
    // Fill and submit
    const input = screen.getByPlaceholderText('Editor name')
    await user.type(input, 'New Editor')
    
    const submitButton = screen.getByRole('button', { name: /create/i })
    await user.click(submitButton)
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to create editor:', expect.any(Error))
    
    consoleSpy.mockRestore()
  })

  test('handles editor selection errors gracefully', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(mockStore.setActiveEditor).mockRejectedValue(new Error('Selection failed'))
    
    render(<EditorSelector />)
    
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'editor-2')
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to set active editor:', expect.any(Error))
    
    consoleSpy.mockRestore()
  })
})
