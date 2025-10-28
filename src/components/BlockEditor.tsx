/**
 * BlockEditor Component
 *
 * Displays and edits the content of a selected block.
 * Shows block metadata and provides a textarea for editing markdown content.
 */

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'

export function BlockEditor() {
  const {
    activeFileId,
    getSelectedBlock,
    getBlockContent,
    writeBlockContent,
    getEditorName,
    isLoading,
  } = useAppStore()

  const selectedBlock = activeFileId ? getSelectedBlock(activeFileId) : null
  const [content, setContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Load block content when selection changes
  useEffect(() => {
    if (selectedBlock) {
      const blockContent = getBlockContent(selectedBlock)
      setContent(blockContent)
      setHasChanges(false)
    } else {
      setContent('')
      setHasChanges(false)
    }
  }, [selectedBlock])

  const handleSave = async () => {
    if (!activeFileId || !selectedBlock) return

    try {
      await writeBlockContent(activeFileId, selectedBlock.block_id, content)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save block content:', error)
    }
  }

  const handleContentChange = (value: string) => {
    setContent(value)
    setHasChanges(true)
  }

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  if (!selectedBlock) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="text-lg font-medium">No block selected</p>
          <p className="text-sm">Select a block from the list to edit</p>
        </div>
      </div>
    )
  }

  const ownerName = activeFileId
    ? getEditorName(activeFileId, selectedBlock.owner)
    : selectedBlock.owner

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{selectedBlock.name}</h2>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isLoading}
            size="sm"
          >
            <Save className="mr-2 h-4 w-4" />
            Save {hasChanges && '*'}
          </Button>
        </div>

        {/* Block metadata */}
        <div className="text-muted-foreground space-y-1 text-xs">
          <div>
            Type: <span className="font-medium">{selectedBlock.block_type}</span>
          </div>
          <div>
            Owner:{' '}
            <span className="font-medium">
              {ownerName} ({selectedBlock.owner})
            </span>
          </div>
          <div>
            ID:{' '}
            <code className="rounded bg-gray-100 px-1 font-mono">
              {selectedBlock.block_id}
            </code>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden p-4">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-full w-full resize-none rounded border border-gray-300 p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Enter markdown content here..."
        />
      </div>

      {/* Footer */}
      {hasChanges && (
        <div className="border-t bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          You have unsaved changes. Press Ctrl+S or click Save to save.
        </div>
      )}
    </div>
  )
}
