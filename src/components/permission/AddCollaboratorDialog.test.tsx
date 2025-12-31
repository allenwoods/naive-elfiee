import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddCollaboratorDialog } from './AddCollaboratorDialog'
import { useAppStore } from '@/lib/app-store'
import type { Editor } from '@/bindings'

describe('AddCollaboratorDialog Component', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    const store = useAppStore.getState()
    // Reset any specific behavior
    store.createEditor.mockImplementation(
      async () =>
        ({
          editor_id: 'new-123',
          name: 'Bob',
          editor_type: 'Human',
        }) as Editor
    )
  })

  describe('Rendering', () => {
    it('should not render when open is false', () => {
      render(
        <AddCollaboratorDialog
          fileId="file-1"
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
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const nameInput = screen.getByPlaceholderText(/enter collaborator name/i)
      expect(nameInput).toBeInTheDocument()
    })

    it('should have Human selected by default', () => {
      render(
        <AddCollaboratorDialog
          fileId="file-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const radios = screen.getAllByRole('radio')
      const humanRadio = radios[0]
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
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const botRadio = screen.getByRole('radio', { name: /bot/i })
      await user.click(botRadio)
      expect(botRadio).toBeChecked()
    })
  })

  describe('Creating Collaborator', () => {
    it('should create human collaborator with valid name', async () => {
      const user = userEvent.setup()
      const store = useAppStore.getState()
      const newEditor: Editor = {
        editor_id: 'new-123',
        name: 'Bob',
        editor_type: 'Human',
      }
      store.createEditor.mockResolvedValue(newEditor)

      render(
        <AddCollaboratorDialog
          fileId="file-1"
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
        expect(store.createEditor).toHaveBeenCalledWith(
          'file-1',
          'Bob',
          'Human'
        )
        expect(mockOnSuccess).toHaveBeenCalledWith(newEditor)
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('Loading State', () => {
    it('should disable inputs while creating', async () => {
      const user = userEvent.setup()
      const store = useAppStore.getState()

      // Use a delayed promise to capture the loading state
      store.createEditor.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  editor_id: 'new-123',
                  name: 'Bob',
                  editor_type: 'Human',
                } as Editor),
              200
            )
          })
      )

      render(
        <AddCollaboratorDialog
          fileId="file-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      await user.type(
        screen.getByPlaceholderText(/enter collaborator name/i),
        'Bob'
      )
      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      // Button text should change to "Creating..."
      await waitFor(() => {
        expect(screen.getByText(/creating/i)).toBeInTheDocument()
      })

      expect(
        screen.getByPlaceholderText(/enter collaborator name/i)
      ).toBeDisabled()
    })
  })
})
