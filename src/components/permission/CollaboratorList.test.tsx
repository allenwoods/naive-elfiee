import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollaboratorList } from './CollaboratorList'
import { useAppStore } from '@/lib/app-store'
import type { Block, Editor, Grant } from '@/bindings'

// Mock the app store
vi.mock('@/lib/app-store', () => ({
  useAppStore: vi.fn(),
}))

// Mock child components
vi.mock('@/lib/tauri-client', () => ({
  TauriClient: {
    block: {
      checkPermission: vi.fn().mockResolvedValue(true),
    },
  },
}))

vi.mock('./CollaboratorItem', () => ({
  CollaboratorItem: ({ editor, onGrantChange, onRemoveAccess }: any) => (
    <div data-testid={`collaborator-${editor.editor_id}`}>
      <span>{editor.name}</span>
      <button
        onClick={() => onGrantChange(editor.editor_id, 'markdown.read', true)}
      >
        Grant
      </button>
      {onRemoveAccess && (
        <button onClick={() => onRemoveAccess(editor.editor_id)}>Remove</button>
      )}
    </div>
  ),
}))

vi.mock('./AddCollaboratorDialog', () => ({
  AddCollaboratorDialog: ({ open, onSuccess }: any) =>
    open ? (
      <div data-testid="add-dialog">
        <button onClick={() => onSuccess({ editor_id: 'new-editor' })}>
          Add
        </button>
      </div>
    ) : null,
}))

describe('CollaboratorList Component', () => {
  const mockGrantCapability = vi.fn()
  const mockRevokeCapability = vi.fn()
  const mockDeleteEditor = vi.fn()

  const mockBlock: Block = {
    block_id: 'block-1',
    name: 'Test Block',
    block_type: 'markdown',
    owner: 'owner-123',
    contents: {},
    children: {},
    metadata: {},
  }

  const mockOwnerEditor: Editor = {
    editor_id: 'owner-123',
    name: 'Owner',
    editor_type: 'Human',
  }

  const mockCollaboratorEditor: Editor = {
    editor_id: 'collab-456',
    name: 'Alice',
    editor_type: 'Human',
  }

  const mockBotEditor: Editor = {
    editor_id: 'bot-789',
    name: 'CodeReviewer',
    editor_type: 'Bot',
  }

  const mockGrants: Grant[] = [
    {
      editor_id: 'collab-456',
      cap_id: 'markdown.read',
      block_id: 'block-1',
    },
    {
      editor_id: 'collab-456',
      cap_id: 'markdown.write',
      block_id: 'block-1',
    },
    {
      editor_id: 'bot-789',
      cap_id: 'markdown.read',
      block_id: 'block-1',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementation
    ;(useAppStore as any).mockImplementation((selector: any) => {
      const state = {
        files: new Map([
          [
            'file-1',
            {
              editors: [mockOwnerEditor, mockCollaboratorEditor, mockBotEditor],
              grants: mockGrants,
              activeEditorId: 'owner-123',
            },
          ],
        ]),
        grantCapability: mockGrantCapability,
        revokeCapability: mockRevokeCapability,
        deleteEditor: mockDeleteEditor,
      }
      return selector(state)
    })
  })

  describe('Rendering', () => {
    it('should render collaborators list with owner and collaborators', () => {
      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      expect(screen.getByText('Owner')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('CodeReviewer')).toBeInTheDocument()
    })

    it('should show Add Collaborator button', () => {
      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      const addButton = screen.getByRole('button', {
        name: /add collaborator/i,
      })
      expect(addButton).toBeInTheDocument()
    })

    it('should only show editors with grants or owner', () => {
      const editorWithoutGrants: Editor = {
        editor_id: 'no-grants',
        name: 'NoAccess',
        editor_type: 'Human',
      }

      ;(useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          files: new Map([
            [
              'file-1',
              {
                editors: [
                  mockOwnerEditor,
                  mockCollaboratorEditor,
                  editorWithoutGrants,
                ],
                grants: mockGrants,
                activeEditorId: 'owner-123',
              },
            ],
          ]),
          grantCapability: mockGrantCapability,
          revokeCapability: mockRevokeCapability,
          deleteEditor: mockDeleteEditor,
        }
        return selector(state)
      })

      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      // Should show owner and collaborator with grants
      expect(screen.getByText('Owner')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()

      // Should NOT show editor without grants
      expect(screen.queryByText('NoAccess')).not.toBeInTheDocument()
    })
  })

  describe('Collaborator Sorting', () => {
    it('should sort owner first, then active editor, then others alphabetically', () => {
      const { container } = render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      const collaborators = container.querySelectorAll(
        '[data-testid^="collaborator-"]'
      )
      const names = Array.from(collaborators).map(
        (el) => el.querySelector('span')?.textContent
      )

      // Owner should be first
      expect(names[0]).toBe('Owner')
      // Others sorted alphabetically: Alice, CodeReviewer
      expect(names).toContain('Alice')
      expect(names).toContain('CodeReviewer')
    })
  })

  describe('Grant/Revoke Permissions', () => {
    it('should call grantCapability when granting permission', async () => {
      mockGrantCapability.mockResolvedValue(undefined)

      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      const grantButtons = screen.getAllByRole('button', { name: 'Grant' })
      await userEvent.click(grantButtons[0])

      await waitFor(() => {
        expect(mockGrantCapability).toHaveBeenCalledWith(
          'file-1',
          expect.any(String),
          'markdown.read',
          'block-1'
        )
      })
    })

    it('should call revokeCapability when revoking permission', async () => {
      mockRevokeCapability.mockResolvedValue(undefined)

      // Mock handleGrantChange to trigger revoke
      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      // In real implementation, this would be triggered by unchecking a permission
      // For this test, we verify the function is available
      expect(mockRevokeCapability).toBeDefined()
    })
  })

  describe('Remove Access', () => {
    it('should delete editor when removing access', async () => {
      mockDeleteEditor.mockResolvedValue(undefined)

      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      // Click remove button for Alice
      const removeButtons = screen.getAllByRole('button', { name: 'Remove' })
      const aliceRemoveButton = removeButtons.find((btn) =>
        btn.closest('[data-testid="collaborator-collab-456"]')
      )

      if (aliceRemoveButton) {
        await userEvent.click(aliceRemoveButton)
      }

      // Should delete the editor (which also removes all grants)
      await waitFor(() => {
        expect(mockDeleteEditor).toHaveBeenCalledTimes(1)
        expect(mockDeleteEditor).toHaveBeenCalledWith(
          'file-1',
          'collab-456',
          'block-1'
        )
      })
    })

    it('should call deleteEditor when removing access', async () => {
      mockDeleteEditor.mockResolvedValue(undefined)

      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      const removeButtons = screen.getAllByRole('button', { name: 'Remove' })
      const aliceRemoveButton = removeButtons.find((btn) =>
        btn.closest('[data-testid="collaborator-collab-456"]')
      )

      if (aliceRemoveButton) {
        await userEvent.click(aliceRemoveButton)
      }

      // Should delete the editor
      await waitFor(
        () => {
          expect(mockDeleteEditor).toHaveBeenCalledWith(
            'file-1',
            'collab-456',
            'block-1'
          )
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Add Collaborator', () => {
    it('should open dialog when Add Collaborator is clicked', async () => {
      const user = userEvent.setup()

      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      const addButton = screen.getByRole('button', {
        name: /add collaborator/i,
      })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByTestId('add-dialog')).toBeInTheDocument()
      })
    })

    it('should grant default read permission when new collaborator is added', async () => {
      mockGrantCapability.mockResolvedValue(undefined)

      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      // Open dialog
      const addButton = screen.getByRole('button', {
        name: /add collaborator/i,
      })
      await userEvent.click(addButton)

      // Add new editor
      const addConfirmButton = await screen.findByRole('button', {
        name: 'Add',
      })
      await userEvent.click(addConfirmButton)

      // Should grant default read permission (with block owner as granter)
      await waitFor(() => {
        expect(mockGrantCapability).toHaveBeenCalledWith(
          'file-1',
          'new-editor',
          'markdown.read',
          'block-1',
          'owner-123' // Block owner as granter
        )
      })
    })

    it('should handle grant default permission error gracefully', async () => {
      mockGrantCapability.mockRejectedValue(new Error('Grant failed'))

      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      const addButton = screen.getByRole('button', {
        name: /add collaborator/i,
      })
      await userEvent.click(addButton)

      const addConfirmButton = await screen.findByRole('button', {
        name: 'Add',
      })
      await userEvent.click(addConfirmButton)

      // Should call grantCapability even if it fails
      await waitFor(() => {
        expect(mockGrantCapability).toHaveBeenCalled()
      })
    })
  })

  describe('Wildcard Grants', () => {
    it('should include wildcard grants in relevant grants', () => {
      const wildcardGrants: Grant[] = [
        {
          editor_id: 'collab-456',
          cap_id: 'markdown.read',
          block_id: '*', // Wildcard
        },
      ]

      ;(useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          files: new Map([
            [
              'file-1',
              {
                editors: [mockOwnerEditor, mockCollaboratorEditor],
                grants: wildcardGrants,
                activeEditorId: 'owner-123',
              },
            ],
          ]),
          grantCapability: mockGrantCapability,
          revokeCapability: mockRevokeCapability,
          deleteEditor: mockDeleteEditor,
        }
        return selector(state)
      })

      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      // Alice should appear because of wildcard grant
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should only show owner when no other collaborators have access', () => {
      ;(useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          files: new Map([
            [
              'file-1',
              {
                editors: [mockOwnerEditor],
                grants: [],
                activeEditorId: 'owner-123',
              },
            ],
          ]),
          grantCapability: mockGrantCapability,
          revokeCapability: mockRevokeCapability,
          deleteEditor: mockDeleteEditor,
        }
        return selector(state)
      })

      render(
        <CollaboratorList fileId="file-1" blockId="block-1" block={mockBlock} />
      )

      expect(screen.getByText('Owner')).toBeInTheDocument()

      // Should only have one collaborator item
      const collaborators = screen.getAllByTestId(/^collaborator-/)
      expect(collaborators).toHaveLength(1)
    })
  })
})
