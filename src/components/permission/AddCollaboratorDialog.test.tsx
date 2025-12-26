import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddCollaboratorDialog } from './AddCollaboratorDialog'
import { useAppStore } from '@/lib/app-store'
import type { Editor } from '@/bindings'

// Mock the app store
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

describe('AddCollaboratorDialog Component', () => {
  const mockCreateEditor = vi.fn()
  const mockOnOpenChange = vi.fn()
  const mockOnSuccess = vi.fn()

  const existingEditors: Editor[] = [
    {
      editor_id: 'existing-1',
      name: 'Alice',
      editor_type: 'Human',
    },
    {
      editor_id: 'existing-2',
      name: 'BotReviewer',
      editor_type: 'Bot',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAppStore as any).mockReturnValue({
      createEditor: mockCreateEditor,
    })
  })

  describe('Rendering', () => {
    it('should not render when open is false', () => {
      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={false}
          onOpenChange={mockOnOpenChange}
        />
      )

      expect(screen.queryByText('Add Collaborator')).not.toBeInTheDocument()
    })

    it('should render when open is true', () => {
      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      expect(screen.getByText('Add Collaborator')).toBeInTheDocument()
    })

    it('should render name input field', () => {
      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      expect(nameInput).toBeInTheDocument()
    })

    it('should render type selection (Human/Bot)', () => {
      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      // Look for text content in the labels
      expect(screen.getByText(/human/i)).toBeInTheDocument()
      expect(screen.getByText(/bot/i)).toBeInTheDocument()
    })

    it('should have Human selected by default', () => {
      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const radios = screen.getAllByRole('radio')
      const humanRadio = radios[0] // First radio should be Human
      expect(humanRadio).toHaveAttribute('value', 'Human')
      expect(humanRadio).toBeChecked()
    })
  })

  describe('Type Selection', () => {
    it('should allow selecting Bot type', async () => {
      const user = userEvent.setup()

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const radios = screen.getAllByRole('radio')
      const botRadio = radios[1] // Second radio should be Bot

      await user.click(botRadio)

      expect(botRadio).toBeChecked()
    })

    it('should allow switching between Human and Bot', async () => {
      const user = userEvent.setup()

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const radios = screen.getAllByRole('radio')
      const humanRadio = radios[0]
      const botRadio = radios[1]

      // Start with Human selected
      expect(humanRadio).toBeChecked()

      // Switch to Bot
      await user.click(botRadio)
      expect(botRadio).toBeChecked()
      expect(humanRadio).not.toBeChecked()

      // Switch back to Human
      await user.click(humanRadio)
      expect(humanRadio).toBeChecked()
      expect(botRadio).not.toBeChecked()
    })
  })

  describe('Creating Collaborator', () => {
    it('should create human collaborator with valid name', async () => {
      const user = userEvent.setup()
      const newEditor: Editor = {
        editor_id: 'new-123',
        name: 'Bob',
        editor_type: 'Human',
      }
      mockCreateEditor.mockResolvedValue(newEditor)

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, 'Bob')

      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(mockCreateEditor).toHaveBeenCalledWith('file-1', 'Bob', 'Human')
      })

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(newEditor)
      })

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('should create bot collaborator when Bot type is selected', async () => {
      const user = userEvent.setup()
      const newBot: Editor = {
        editor_id: 'bot-456',
        name: 'CodeHelper',
        editor_type: 'Bot',
      }
      mockCreateEditor.mockResolvedValue(newBot)

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, 'CodeHelper')

      const radios = screen.getAllByRole('radio')
      const botRadio = radios[1]
      await user.click(botRadio)

      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(mockCreateEditor).toHaveBeenCalledWith(
          'file-1',
          'CodeHelper',
          'Bot'
        )
      })
    })

    it('should trim whitespace from name', async () => {
      const user = userEvent.setup()
      mockCreateEditor.mockResolvedValue({
        editor_id: 'new-123',
        name: 'Bob',
        editor_type: 'Human',
      })

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, '  Bob  ')

      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(mockCreateEditor).toHaveBeenCalledWith('file-1', 'Bob', 'Human')
      })
    })

    it('should support creating via Enter key', async () => {
      const user = userEvent.setup()
      mockCreateEditor.mockResolvedValue({
        editor_id: 'new-123',
        name: 'Bob',
        editor_type: 'Human',
      })

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, 'Bob')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockCreateEditor).toHaveBeenCalledWith('file-1', 'Bob', 'Human')
      })
    })
  })

  describe('Validation', () => {
    it('should disable create button when name is empty', async () => {
      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const createButton = screen.getByRole('button', { name: /create/i })
      expect(createButton).toBeDisabled()

      expect(mockCreateEditor).not.toHaveBeenCalled()
    })

    it('should disable create button for whitespace-only name', async () => {
      const user = userEvent.setup()

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, '   ')

      const createButton = screen.getByRole('button', { name: /create/i })
      expect(createButton).toBeDisabled()
    })

    it('should show error for duplicate name (case-insensitive)', async () => {
      const user = userEvent.setup()

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, 'alice') // lowercase, but Alice exists

      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(
          screen.getByText('A collaborator with this name already exists')
        ).toBeInTheDocument()
      })

      expect(mockCreateEditor).not.toHaveBeenCalled()
    })

    it('should clear error when user types after duplicate name error', async () => {
      const user = userEvent.setup()

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      // Type duplicate name
      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, 'Alice')

      // Try to create
      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      // Error should appear
      await waitFor(() => {
        expect(
          screen.getByText('A collaborator with this name already exists')
        ).toBeInTheDocument()
      })

      // Start typing - error should clear
      await user.clear(nameInput)
      await user.type(nameInput, 'B')

      // Error should be cleared
      await waitFor(() => {
        expect(
          screen.queryByText('A collaborator with this name already exists')
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('Form Reset', () => {
    it('should reset form when dialog is closed via cancel button', async () => {
      const user = userEvent.setup()

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      // Fill out form
      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, 'Bob')

      const radios = screen.getAllByRole('radio')
      const botRadio = radios[1]
      await user.click(botRadio)

      // Verify bot is selected
      expect(botRadio).toBeChecked()

      // Click cancel button - this triggers onOpenChange(false)
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Verify onOpenChange was called with false
      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('should reset form after successful creation', async () => {
      const user = userEvent.setup()
      mockCreateEditor.mockResolvedValue({
        editor_id: 'new-123',
        name: 'Bob',
        editor_type: 'Human',
      })

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const nameInput = screen.getByLabelText(/name/i)
      await user.type(nameInput, 'Bob')

      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })

      // Dialog should close and form should be reset for next time
    })
  })

  describe('Loading State', () => {
    it('should disable inputs while creating', async () => {
      const user = userEvent.setup()
      mockCreateEditor.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  editor_id: 'new-123',
                  name: 'Bob',
                  editor_type: 'Human',
                }),
              100
            )
          )
      )

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, 'Bob')

      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      // Button text should change to "Creating..."
      await waitFor(() => {
        expect(screen.getByText(/creating/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle creation error gracefully', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      mockCreateEditor.mockRejectedValue(new Error('Network error'))

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          existingEditors={existingEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      await user.type(nameInput, 'Bob')

      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to create collaborator:',
          expect.any(Error)
        )
      })

      consoleErrorSpy.mockRestore()
    })
  })
})
