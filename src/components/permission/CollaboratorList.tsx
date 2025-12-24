import { useState, useMemo } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/app-store'
import { CollaboratorItem } from './CollaboratorItem'
import { AddCollaboratorDialog } from './AddCollaboratorDialog'
import { toast } from 'sonner'
import type { Block } from '@/bindings'

// Default capability granted to new collaborators
const DEFAULT_CAPABILITY = 'markdown.read' as const

interface CollaboratorListProps {
  fileId: string
  blockId: string
  block: Block
}

export const CollaboratorList = ({
  fileId,
  blockId,
  block,
}: CollaboratorListProps) => {
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Subscribe to store state changes - directly access files Map for reactivity
  const editors = useAppStore((state) => {
    const fileState = state.files.get(fileId)
    return fileState?.editors || []
  })
  const grants = useAppStore((state) => {
    const fileState = state.files.get(fileId)
    return fileState?.grants || []
  })
  const activeEditor = useAppStore((state) => {
    const fileState = state.files.get(fileId)
    if (!fileState?.activeEditorId) return undefined
    return fileState.editors.find(
      (e) => e.editor_id === fileState.activeEditorId
    )
  })
  const grantCapability = useAppStore((state) => state.grantCapability)
  const revokeCapability = useAppStore((state) => state.revokeCapability)
  const deleteEditor = useAppStore((state) => state.deleteEditor)

  // Filter grants relevant to this block (including wildcards)
  const relevantGrants = useMemo(() => {
    return grants.filter((g) => g.block_id === blockId || g.block_id === '*')
  }, [grants, blockId])

  // Get editors with permissions for this block
  const collaborators = useMemo(() => {
    // Get all editors who have grants for this block or are the owner
    const editorsWithAccess = editors.filter((editor) => {
      // Owner always has access
      if (editor.editor_id === block.owner) return true

      // Check if editor has any grants for this block
      return relevantGrants.some((g) => g.editor_id === editor.editor_id)
    })

    // Sort: owner first, then active editor, then others
    return editorsWithAccess.sort((a, b) => {
      // Owner always first
      if (a.editor_id === block.owner) return -1
      if (b.editor_id === block.owner) return 1

      // Active editor second
      if (a.editor_id === activeEditor?.editor_id) return -1
      if (b.editor_id === activeEditor?.editor_id) return 1

      // Others by name
      return a.name.localeCompare(b.name)
    })
  }, [editors, block.owner, activeEditor, relevantGrants])

  const handleGrantChange = async (
    editorId: string,
    capability: string,
    granted: boolean
  ) => {
    if (granted) {
      await grantCapability(fileId, editorId, capability, blockId)
    } else {
      await revokeCapability(fileId, editorId, capability, blockId)
    }
  }

  const handleRemoveAccess = async (editorId: string) => {
    // Delete the editor completely, which also removes all their grants
    try {
      await deleteEditor(fileId, editorId)
    } catch (error) {
      console.error('Failed to remove collaborator:', error)
      // deleteEditor already shows a toast, so we don't need to show another one
      throw error
    }
  }

  const handleAddSuccess = async (newEditor: { editor_id: string }) => {
    // Grant default read permission to the new collaborator
    try {
      await grantCapability(
        fileId,
        newEditor.editor_id,
        DEFAULT_CAPABILITY,
        blockId
      )
    } catch (error) {
      console.error('Failed to grant default read permission:', error)
      toast.warning(
        'Collaborator created but failed to grant read permission. You can manually grant permissions.'
      )
      // Don't throw - the editor was created successfully
    }
  }

  // Show empty state if no collaborators
  if (collaborators.length === 0) {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Collaborators (0)
          </h3>
          <Button
            onClick={() => setShowAddDialog(true)}
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-muted"
            title="Add Collaborator"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/10 py-8 text-center">
          <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">No collaborators yet</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="h-auto px-0 py-1 text-xs text-primary"
          >
            Add one now
          </Button>
        </div>

        <AddCollaboratorDialog
          fileId={fileId}
          existingEditors={editors}
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSuccess={handleAddSuccess}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Collaborators ({collaborators.length})
        </h3>
        <Button
          onClick={() => setShowAddDialog(true)}
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-muted"
          title="Add Collaborator"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>

      {/* Collaborator List */}
      <div className="space-y-2">
        {collaborators.map((editor) => (
          <CollaboratorItem
            key={editor.editor_id}
            blockId={blockId}
            editor={editor}
            grants={relevantGrants.filter(
              (g) => g.editor_id === editor.editor_id
            )}
            isOwner={editor.editor_id === block.owner}
            isActive={editor.editor_id === activeEditor?.editor_id}
            onGrantChange={handleGrantChange}
            onRemoveAccess={handleRemoveAccess}
          />
        ))}
      </div>

      {/* Add Collaborator Dialog */}
      <AddCollaboratorDialog
        fileId={fileId}
        existingEditors={editors}
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}
