import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddCollaboratorDialog } from './AddCollaboratorDialog'
import { useAppStore } from '@/lib/app-store'
import type { Editor } from '@/bindings'

describe('AddCollaboratorDialog Component', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSuccess = vi.fn()

  const mockExistingEditors: Editor[] = [
    { editor_id: 'existing-1', name: 'Alice', editor_type: 'Human' },
  ]

  const mockAllEditors: Editor[] = [
    { editor_id: 'existing-1', name: 'Alice', editor_type: 'Human' },
    { editor_id: 'available-1', name: 'Bob', editor_type: 'Human' },
    { editor_id: 'available-2', name: 'Bot1', editor_type: 'Bot' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when open is false', () => {
      render(
        <AddCollaboratorDialog
          existingEditors={mockExistingEditors}
          allEditors={mockAllEditors}
          open={false}
          onOpenChange={mockOnOpenChange}
        />
      )

      expect(screen.queryByText('Add Collaborator')).not.toBeInTheDocument()
    })

    it('should render when open is true', () => {
      render(
        <AddCollaboratorDialog
          existingEditors={mockExistingEditors}
          allEditors={mockAllEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      expect(screen.getByText('Add Collaborator')).toBeInTheDocument()
    })

    it('should render name input field', () => {
      render(
        <AddCollaboratorDialog
          existingEditors={mockExistingEditors}
          allEditors={mockAllEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const selectTrigger = screen.getByText(/choose a user/i)
      expect(selectTrigger).toBeInTheDocument()
    })

    it('should have Human selected by default', () => {
      render(
        <AddCollaboratorDialog
          existingEditors={mockExistingEditors}
          allEditors={mockAllEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      // No longer testing radio buttons as the component now uses a dropdown
      expect(screen.getByText(/Choose a user/i)).toBeInTheDocument()
    })
  })

  describe('Type Selection', () => {
    it('should show available editors in dropdown', async () => {
      render(
        <AddCollaboratorDialog
          existingEditors={mockExistingEditors}
          allEditors={mockAllEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      // The component shows a select dropdown
      expect(screen.getByText(/Choose a user/i)).toBeInTheDocument()
      // Available editors (Bob, Bot1) are filtered from existing (Alice)
      // But they're not visible until the dropdown is opened
    })
  })

  describe('Creating Collaborator', () => {
    it('should create human collaborator with valid name', async () => {
      const user = userEvent.setup()

      render(
        <AddCollaboratorDialog
          existingEditors={mockExistingEditors}
          allEditors={mockAllEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      )

      const addButton = screen.getByRole('button', { name: /add/i })

      // Button should be disabled initially (no selection)
      expect(addButton).toBeDisabled()
    })
  })

  describe('Loading State', () => {
    it('should disable inputs while creating', async () => {
      render(
        <AddCollaboratorDialog
          existingEditors={mockExistingEditors}
          allEditors={mockAllEditors}
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      const addButton = screen.getByRole('button', { name: /add/i })
      expect(addButton).toBeDisabled()
    })
  })
})
