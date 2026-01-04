import { useState, useMemo, useEffect } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/app-store'
import { CollaboratorItem } from './CollaboratorItem'
import { AddCollaboratorDialog } from './AddCollaboratorDialog'
import { toast } from 'sonner'
import type { Block, Editor } from '@/bindings'
import { TauriClient } from '@/lib/tauri-client'

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

  // Subscribe to store state changes
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

  // NOTE: We do NOT use deleteEditor here anymore.
  // "Removing access" simply means revoking all permissions on this block.
  // Deleting a user from the project entirely should be an admin/owner function in Sidebar.

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

      // Check if editor has any grants for this block (not wildcards for other blocks)
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
  }, [editors, block, activeEditor, relevantGrants])

  const handleGrantChange = async (
    editorId: string,
    capability: string,
    granted: boolean
  ) => {
    try {
      // Check if current user has permission to grant/revoke
      const requiredCap = granted ? 'core.grant' : 'core.revoke'
      const hasPermission = await TauriClient.block.checkPermission(
        fileId,
        blockId,
        requiredCap,
        activeEditor?.editor_id
      )

      if (!hasPermission) {
        toast.error(
          `You do not have permission to ${granted ? 'grant' : 'revoke'} permissions.`
        )
        return
      }

      if (granted) {
        await grantCapability(fileId, editorId, capability, blockId)
      } else {
        await revokeCapability(fileId, editorId, capability, blockId)
      }
    } catch (error) {
      console.error('Failed to change permission:', error)
    }
  }

  const handleRemoveAccess = async (editorId: string) => {
    // Revoke ALL permissions for this editor on this block
    try {
      const userGrants = relevantGrants.filter((g) => g.editor_id === editorId)

      // If user has no explicit grants (e.g. implicitly has access via wildcard or just viewing),
      // there's nothing to revoke, but we can't "block" them unless we have a deny list (not implemented).
      // For now, we just remove explicit grants.

      if (userGrants.length === 0) {
        toast.info('User has no explicit permissions to remove.')
        return
      }

      // Execute revokes in parallel
      await Promise.all(
        userGrants.map((grant) =>
          revokeCapability(fileId, editorId, grant.cap_id, blockId)
        )
      )

      toast.success('Access removed (permissions revoked)')
    } catch (error) {
      console.error('Failed to remove access:', error)
      toast.error('Failed to remove access')
    }
  }

  // Check permission state for granting (used to enable/disable Add button)
  const [canAddCollaborator, setCanAddCollaborator] = useState(false)

  useEffect(() => {
    const checkPermission = async () => {
      if (!activeEditor?.editor_id) {
        setCanAddCollaborator(false)
        return
      }
      try {
        // To add a collaborator, you generally need to be able to grant permissions
        // or create editors. We check 'core.grant' as the primary gatekeeper.
        const hasPermission = await TauriClient.block.checkPermission(
          fileId,
          blockId,
          'core.grant',
          activeEditor.editor_id
        )
        setCanAddCollaborator(hasPermission)
      } catch (error) {
        console.error('Failed to check permission:', error)
        setCanAddCollaborator(false)
      }
    }
    checkPermission()
  }, [fileId, blockId, activeEditor?.editor_id])

  const handleAddSuccess = (editor: Editor) => {
    // Dialog handles the creation and granting. We just refresh the list (via store subscription).
    // No extra action needed here.
  }

  const handleOpenAddDialog = () => {
    setShowAddDialog(true)
  }

  // Show empty state if no collaborators (except maybe owner who is filtered out if logic changes, but currently owner is always shown)
  if (collaborators.length === 0) {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Collaborators (0)
          </h3>
          <Button
            onClick={handleOpenAddDialog}
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-muted"
            title={
              canAddCollaborator
                ? 'Add Collaborator'
                : 'You do not have permission to add collaborators'
            }
            disabled={!canAddCollaborator}
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/10 py-8 text-center">
          <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">No collaborators yet</p>
          {canAddCollaborator && (
            <Button
              variant="link"
              size="sm"
              onClick={handleOpenAddDialog}
              className="h-auto px-0 py-1 text-xs text-primary"
            >
              Add one now
            </Button>
          )}
        </div>

        <AddCollaboratorDialog
          fileId={fileId}
          blockId={blockId}
          existingEditors={collaborators}
          allEditors={editors}
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
          onClick={handleOpenAddDialog}
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-muted"
          title={
            canAddCollaborator
              ? 'Add Collaborator'
              : 'You do not have permission to add collaborators'
          }
          disabled={!canAddCollaborator}
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
            blockType={block.block_type}
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
        blockId={blockId}
        existingEditors={collaborators}
        allEditors={editors}
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}
