/**
 * ErrorDisplay Component Tests
 */

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorDisplay } from './ErrorDisplay'
import { useAppStore } from '@/lib/app-store'

// Mock the app store
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

describe('ErrorDisplay Component', () => {
  const mockStore = {
    error: null,
    clearError: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue(mockStore)
  })

  test('renders nothing when no error', () => {
    const { container } = render(<ErrorDisplay />)
    expect(container.firstChild).toBeNull()
  })

  test('displays error message when error exists', () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: 'Test error message',
    })
    
    render(<ErrorDisplay />)
    
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  test('displays different error messages', () => {
    const errorMessages = [
      'Network connection failed',
      'File not found',
      'Permission denied',
      'Invalid input data',
    ]
    
    errorMessages.forEach(errorMessage => {
      vi.mocked(useAppStore).mockReturnValue({
        ...mockStore,
        error: errorMessage,
      })
      
      const { unmount } = render(<ErrorDisplay />)
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      unmount()
    })
  })

  test('calls clearError when close button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: 'Test error message',
    })
    
    render(<ErrorDisplay />)
    
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)
    
    expect(mockStore.clearError).toHaveBeenCalledTimes(1)
  })

  test('renders close button with correct accessibility attributes', () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: 'Test error message',
    })
    
    render(<ErrorDisplay />)
    
    const closeButton = screen.getByRole('button', { name: /close/i })
    expect(closeButton).toBeInTheDocument()
    expect(closeButton).toHaveAttribute('aria-label', 'Close error')
  })

  test('displays error with proper styling classes', () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: 'Test error message',
    })
    
    render(<ErrorDisplay />)
    
    const errorElement = screen.getByText('Test error message')
    const container = errorElement.closest('div')
    
    expect(container).toHaveClass('bg-destructive', 'text-destructive-foreground')
  })

  test('handles long error messages', () => {
    const longErrorMessage = 'This is a very long error message that might wrap to multiple lines and should be handled gracefully by the component without breaking the layout or causing any visual issues in the user interface.'
    
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: longErrorMessage,
    })
    
    render(<ErrorDisplay />)
    
    expect(screen.getByText(longErrorMessage)).toBeInTheDocument()
  })

  test('handles special characters in error messages', () => {
    const specialErrorMessage = 'Error with special chars: <>&"\'`'
    
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: specialErrorMessage,
    })
    
    render(<ErrorDisplay />)
    
    expect(screen.getByText(specialErrorMessage)).toBeInTheDocument()
  })

  test('updates when error changes', () => {
    const { rerender } = render(<ErrorDisplay />)
    
    // Initially no error
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    
    // Add error
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: 'First error',
    })
    rerender(<ErrorDisplay />)
    expect(screen.getByText('First error')).toBeInTheDocument()
    
    // Change error
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: 'Second error',
    })
    rerender(<ErrorDisplay />)
    expect(screen.getByText('Second error')).toBeInTheDocument()
    expect(screen.queryByText('First error')).not.toBeInTheDocument()
    
    // Clear error
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: null,
    })
    rerender(<ErrorDisplay />)
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })

  test('maintains focus management', async () => {
    const user = userEvent.setup()
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStore,
      error: 'Test error message',
    })
    
    render(<ErrorDisplay />)
    
    const closeButton = screen.getByRole('button', { name: /close/i })
    
    // Focus should be manageable
    closeButton.focus()
    expect(document.activeElement).toBe(closeButton)
    
    await user.click(closeButton)
    expect(mockStore.clearError).toHaveBeenCalled()
  })

  test('handles rapid error state changes', () => {
    const errors = ['Error 1', 'Error 2', 'Error 3', null, 'Error 4']
    
    errors.forEach((error, index) => {
      vi.mocked(useAppStore).mockReturnValue({
        ...mockStore,
        error,
      })
      
      const { unmount } = render(<ErrorDisplay />)
      
      if (error) {
        expect(screen.getByText(error)).toBeInTheDocument()
      } else {
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
      }
      
      unmount()
    })
  })
})
