/**
 * BlockList Component
 *
 * Displays all blocks for the active file and provides basic block operations
 */

import { useState } from 'react'
import { useAppStore } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Shield, Link } from 'lucide-react'
import type { Block } from '@/bindings'
// Removed message import - using app-store notifications instead
import { PermissionManager } from './PermissionManager'
import { LinkManager } from './LinkManager'
import { BlockTypeDialog } from './BlockTypeDialog'
import { formatTimestamp } from '@/lib/utils'

function BlockItem({ block, fileId }: { block: Block; fileId: string }) {
  const {
    deleteBlock,
    selectBlock,
    getSelectedBlock,
    getEditorName,
    getBlockLinks,
  } = useAppStore()
  const selectedBlock = getSelectedBlock(fileId)
  const isSelected = selectedBlock?.block_id === block.block_id
  const [showPermissions, setShowPermissions] = useState(false)
  const [showLinks, setShowLinks] = useState(false)

  const handleDelete = async () => {
    await deleteBlock(fileId, block.block_id)
  }

  const handleSelect = () => {
    selectBlock(fileId, block.block_id)
  }

  // Helper to display contents
  const displayContent = () => {
    if (typeof block.contents === 'string') return block.contents
    if (typeof block.contents === 'object' && block.contents !== null) {
      return JSON.stringify(block.contents)
    }
    return '(empty)'
  }

  // Count children
  const childrenCount = Object.values(block.children || {}).reduce(
    (acc, arr) => acc + (arr?.length || 0),
    0
  )

  // Get owner name
  const ownerName = getEditorName(fileId, block.owner)
  const ownerDisplay = `${ownerName} (${block.owner})`

  // Get links count
  const blockLinks = getBlockLinks(block)
  const linksCount = blockLinks.reduce(
    (total, link) => total + link.targetIds.length,
    0
  )

  return (
    <>
      <div
        className={`cursor-pointer rounded-lg border p-4 transition-colors ${
          isSelected ? 'bg-accent border-primary' : 'hover:bg-accent/50'
        }`}
        onClick={handleSelect}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground mb-1 text-xs">
              {block.name || block.block_id}
            </div>
            <div className="text-muted-foreground mb-1 text-xs">
              Type: {block.block_type}
            </div>
            <div className="text-muted-foreground mb-1 text-xs">
              Owner: {ownerDisplay}
            </div>
            <div className="text-sm wrap-break-word">{displayContent()}</div>
            <div className="text-muted-foreground mt-1 flex gap-4 text-xs">
              {childrenCount > 0 && <span>Children: {childrenCount}</span>}
              {linksCount > 0 && <span>Links: {linksCount}</span>}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                setShowLinks(true)
              }}
              variant="ghost"
              size="icon"
              title="Manage Links"
            >
              <Link className="h-4 w-4" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                setShowPermissions(true)
              }}
              variant="ghost"
              size="icon"
              title="Manage Permissions"
            >
              <Shield className="h-4 w-4" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              variant="ghost"
              size="icon"
              title="Delete Block"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Link Manager Dialog */}
      <LinkManager
        fileId={fileId}
        blockId={block.block_id}
        isOpen={showLinks}
        onClose={() => setShowLinks(false)}
      />

      {/* Permission Manager Dialog */}
      <PermissionManager
        fileId={fileId}
        blockId={block.block_id}
        isOpen={showPermissions}
        onClose={() => setShowPermissions(false)}
      />
    </>
  )
}

export function BlockList() {
  const {
    activeFileId,
    getActiveFile,
    createBlock,
    isLoading,
    addNotification,
  } = useAppStore()
  const activeFile = getActiveFile()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const handleCreateBlock = () => {
    console.log('[BlockList] handleCreateBlock called')
    console.log('[BlockList] activeFileId:', activeFileId)

    if (!activeFileId) {
      console.log('[BlockList] No active file, returning')
      return
    }

    // Show the dialog instead of creating block directly
    setShowCreateDialog(true)
  }

  const handleConfirmCreate = async (name: string, blockType: string) => {
    console.log('[BlockList] handleConfirmCreate called with:', { name, blockType })

    if (!activeFileId) {
      console.log('[BlockList] No active file, returning')
      return
    }

    console.log('[BlockList] Calling createBlock...')
    try {
      await createBlock(activeFileId, name, blockType)
      console.log('[BlockList] createBlock succeeded')
      addNotification('success', `${blockType.charAt(0).toUpperCase() + blockType.slice(1)} block created successfully!`)
    } catch (error) {
      console.error('[BlockList] createBlock failed:', error)
      addNotification('error', `Failed to create block: ${error}`)
    }
  }

  if (!activeFileId || !activeFile) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No file opened. Create or open a file to get started.
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Blocks</h2>
          <Button onClick={handleCreateBlock} disabled={isLoading} size="sm">
            <Plus />
            New Block
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeFile.blocks.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              No blocks yet. Create your first block!
            </div>
          ) : (
            <div className="space-y-2">
              {activeFile.blocks.map((block) => (
                <BlockItem
                  key={block.block_id}
                  block={block}
                  fileId={activeFileId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Block Type Dialog */}
      <BlockTypeDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={handleConfirmCreate}
        isLoading={isLoading}
      />
    </>
  )
}
