/**
 * LinkManager Component
 *
 * Dialog for managing block links (relations).
 * Shows current links and allows adding/removing links between blocks.
 */

import { useState } from 'react'
import { useAppStore } from '@/lib/app-store'
import { RELATION_TYPES, getRelationLabel } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface LinkManagerProps {
  fileId: string
  blockId: string
  isOpen: boolean
  onClose: () => void
}

export function LinkManager({
  fileId,
  blockId,
  isOpen,
  onClose,
}: LinkManagerProps) {
  const {
    getBlocks,
    getBlockLinks,
    linkBlocks,
    unlinkBlocks,
    isLoading,
  } = useAppStore()

  const [selectedRelation, setSelectedRelation] = useState('')
  const [selectedTargetBlock, setSelectedTargetBlock] = useState('')

  const allBlocks = getBlocks(fileId)
  const currentBlock = allBlocks.find((b) => b.block_id === blockId)
  const blockLinks = currentBlock ? getBlockLinks(currentBlock) : []

  // Available target blocks (exclude current block)
  const availableBlocks = allBlocks.filter((b) => b.block_id !== blockId)

  const handleAddLink = async () => {
    if (!selectedRelation || !selectedTargetBlock) return

    try {
      await linkBlocks(fileId, blockId, selectedTargetBlock, selectedRelation)
      setSelectedRelation('')
      setSelectedTargetBlock('')
    } catch (error) {
      console.error('Failed to create link:', error)
    }
  }

  const handleRemoveLink = async (relation: string, targetId: string) => {
    try {
      await unlinkBlocks(fileId, blockId, targetId, relation)
    } catch (error) {
      console.error('Failed to remove link:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background w-full max-w-2xl rounded-lg border p-6 shadow-lg">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Manage Block Links</h2>
          <Button onClick={onClose} variant="ghost" size="icon">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Block Info */}
        <div className="text-muted-foreground mb-4 text-sm">
          Block: <span className="font-medium">{currentBlock?.name || blockId}</span>
        </div>

        {/* Current Links */}
        <div className="mb-6">
          <h3 className="mb-2 font-medium">Current Links</h3>
          {blockLinks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No links yet.</p>
          ) : (
            <div className="space-y-2">
              {blockLinks.map(({ relation, targetIds }) =>
                targetIds.map((targetId) => {
                  const targetBlock = allBlocks.find((b) => b.block_id === targetId)
                  return (
                    <div
                      key={`${relation}-${targetId}`}
                      className="flex items-center justify-between rounded border p-3"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {getRelationLabel(relation)}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          → {targetBlock?.name || targetId}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleRemoveLink(relation, targetId)}
                        variant="destructive"
                        size="sm"
                        disabled={isLoading}
                      >
                        Remove
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Add New Link */}
        <div>
          <h3 className="mb-2 font-medium">Add Link</h3>
          <div className="flex gap-2">
            <select
              value={selectedRelation}
              onChange={(e) => setSelectedRelation(e.target.value)}
              className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={isLoading}
            >
              <option value="">Select Relation</option>
              {RELATION_TYPES.map((rel) => (
                <option key={rel.id} value={rel.id}>
                  {rel.label}
                </option>
              ))}
            </select>

            <select
              value={selectedTargetBlock}
              onChange={(e) => setSelectedTargetBlock(e.target.value)}
              className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={isLoading}
            >
              <option value="">Select Target Block</option>
              {availableBlocks.map((block) => (
                <option key={block.block_id} value={block.block_id}>
                  {block.name}
                </option>
              ))}
            </select>

            <Button
              onClick={handleAddLink}
              disabled={!selectedRelation || !selectedTargetBlock || isLoading}
              size="sm"
            >
              Add Link
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
