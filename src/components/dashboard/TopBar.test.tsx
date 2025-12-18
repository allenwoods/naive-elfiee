import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopBar } from './TopBar'

describe('TopBar Component', () => {
  describe('Rendering', () => {
    it('should render with default title', () => {
      render(<TopBar />)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    it('should render with custom title', () => {
      render(<TopBar title="Projects" />)
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    it('should render search input with placeholder', () => {
      const placeholder = 'Search projects...'
      render(<TopBar searchPlaceholder={placeholder} />)

      const input = screen.getByPlaceholderText(placeholder)
      expect(input).toBeInTheDocument()
    })

    it('should render search icon', () => {
      const { container } = render(<TopBar />)
      const searchIcon = container.querySelector('svg')
      expect(searchIcon).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('should display searchValue in input', () => {
      const searchValue = 'test query'
      render(<TopBar searchValue={searchValue} />)

      const input = screen.getByDisplayValue(searchValue)
      expect(input).toBeInTheDocument()
    })

    it('should call onSearchChange when user types', async () => {
      const user = userEvent.setup()
      const handleSearchChange = vi.fn()

      render(<TopBar onSearchChange={handleSearchChange} />)

      const input = screen.getByPlaceholderText(/ask anything/i)
      await user.type(input, 't')

      expect(handleSearchChange).toHaveBeenCalledTimes(1)
      expect(handleSearchChange).toHaveBeenLastCalledWith('t')
    })

    it('should handle empty input', async () => {
      const user = userEvent.setup()
      const handleSearchChange = vi.fn()

      render(<TopBar searchValue="test" onSearchChange={handleSearchChange} />)

      const input = screen.getByDisplayValue('test')
      await user.clear(input)

      expect(handleSearchChange).toHaveBeenCalled()
    })

    it('should not break if onSearchChange is undefined', async () => {
      const user = userEvent.setup()

      render(<TopBar />)

      const input = screen.getByPlaceholderText(/ask anything/i)

      // Should not throw error
      await expect(user.type(input, 'test')).resolves.not.toThrow()
    })
  })

  describe('Controlled vs Uncontrolled', () => {
    it('should work as controlled component', async () => {
      const user = userEvent.setup()
      const handleSearchChange = vi.fn()

      const { rerender } = render(
        <TopBar searchValue="" onSearchChange={handleSearchChange} />
      )

      const input = screen.getByPlaceholderText(/ask anything/i)
      await user.type(input, 't')

      expect(handleSearchChange).toHaveBeenCalledWith('t')

      // Simulate parent component updating the value
      rerender(<TopBar searchValue="t" onSearchChange={handleSearchChange} />)

      expect(input).toHaveValue('t')
    })

    it('should work as uncontrolled component', () => {
      render(<TopBar />)

      const input = screen.getByPlaceholderText(/ask anything/i)
      expect(input).toHaveValue('')
    })
  })

  describe('Accessibility', () => {
    it('should have proper input type', () => {
      render(<TopBar />)

      const input = screen.getByPlaceholderText(/ask anything/i)
      expect(input).toHaveAttribute('type', 'text')
    })

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup()
      const handleSearchChange = vi.fn()

      render(<TopBar onSearchChange={handleSearchChange} />)

      const input = screen.getByPlaceholderText(/ask anything/i)

      // Tab to focus
      await user.tab()
      expect(input).toHaveFocus()

      // Type while focused
      await user.keyboard('test')
      expect(handleSearchChange).toHaveBeenCalled()
    })
  })

  describe('Styling', () => {
    it('should have correct CSS classes', () => {
      const { container } = render(<TopBar />)

      const header = container.querySelector('header')
      expect(header).toHaveClass('sticky', 'top-0', 'z-40')
    })

    it('should have search input with proper styling', () => {
      render(<TopBar />)

      const input = screen.getByPlaceholderText(/ask anything/i)
      expect(input).toHaveClass('h-12', 'rounded-2xl', 'pl-12')
    })
  })
})
