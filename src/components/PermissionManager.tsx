/**
 * PermissionManager Component
 *
 * Dialog for managing block permissions (grants).
 * Shows current grants and allows adding/revoking permissions.
 */

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/app-store'
import type { Grant } from '@/bindings'
import { AVAILABLE_CAPABILITIES, getCapabilityLabel } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface PermissionManagerProps {
  fileId: string
  blockId: string
  isOpen: boolean
  onClose: () => void
}

export function PermissionManager({
  fileId,
  blockId,
  isOpen,
  onClose,
}: PermissionManagerProps) {
  const {
    getEditors,
    getEditorName,
    grantCapability,
    revokeCapability,
    isLoading,
  } = useAppStore()

  const [blockGrants, setBlockGrants] = useState<Grant[]>([])
  const [selectedEditor, setSelectedEditor] = useState('')
  const [selectedCapability, setSelectedCapability] = useState('')

  const editors = getEditors(fileId)

  // Load block grants when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadBlockGrants()
    }
  }, [isOpen, fileId, blockId])

  const loadBlockGrants = async () => {
    try {
      const grants = await useAppStore.getState().getGrants(fileId)
      // Filter grants that apply to this block
      const relevantGrants = grants.filter(
        (g) => g.block_id === blockId || g.block_id === '*'
      )
      setBlockGrants(relevantGrants)
    } catch (error) {
      console.error('Failed to load block grants:', error)
    }
  }

  const handleGrant = async () => {
    if (!selectedEditor || !selectedCapability) return

    try {
      await grantCapability(fileId, selectedEditor, selectedCapability, blockId)
      setSelectedEditor('')
      setSelectedCapability('')
      await loadBlockGrants()
    } catch (error) {
      console.error('Failed to grant capability:', error)
    }
  }

  const handleRevoke = async (grant: Grant) => {
    try {
      await revokeCapability(
        fileId,
        grant.editor_id,
        grant.cap_id,
        grant.block_id
      )
      await loadBlockGrants()
    } catch (error) {
      console.error('Failed to revoke capability:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background w-full max-w-2xl rounded-lg border p-6 shadow-lg">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Manage Permissions</h2>
          <Button onClick={onClose} variant="ghost" size="icon">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Block Info */}
        <div className="text-muted-foreground mb-4 text-sm">
          Block ID: <code className="rounded bg-gray-100 px-1">{blockId}</code>
        </div>

        {/* Current Grants */}
        <div className="mb-6">
          <h3 className="mb-2 font-medium">Current Permissions</h3>
          {blockGrants.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No permissions granted yet.
            </p>
          ) : (
            <div className="space-y-2">
              {blockGrants.map((grant, index) => (
                <div
                  key={`${grant.editor_id}-${grant.cap_id}-${index}`}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {getEditorName(fileId, grant.editor_id)}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {getCapabilityLabel(grant.cap_id)}
                      {grant.block_id === '*' && ' (All Blocks)'}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleRevoke(grant)}
                    variant="destructive"
                    size="sm"
                    disabled={isLoading}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Grant */}
        <div>
          <h3 className="mb-2 font-medium">Add Permission</h3>
          <div className="flex gap-2">
            <select
              value={selectedEditor}
              onChange={(e) => setSelectedEditor(e.target.value)}
              className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={isLoading}
            >
              <option value="">Select Editor</option>
              {editors.map((editor) => (
                <option key={editor.editor_id} value={editor.editor_id}>
                  {editor.name}
                </option>
              ))}
            </select>

            <select
              value={selectedCapability}
              onChange={(e) => setSelectedCapability(e.target.value)}
              className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={isLoading}
            >
              <option value="">Select Capability</option>
              {AVAILABLE_CAPABILITIES.map((cap) => (
                <option key={cap.id} value={cap.id}>
                  {cap.label}
                </option>
              ))}
            </select>

            <Button
              onClick={handleGrant}
              disabled={!selectedEditor || !selectedCapability || isLoading}
              size="sm"
            >
              Grant
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
