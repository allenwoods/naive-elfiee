/**
 * Toolbar Component
 *
 * Provides file operations: New, Open, Save, Close
 * And editor management: Editor selector
 */

import { useAppStore } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { FilePlus, FolderOpen, Save, X } from 'lucide-react'
import { EditorSelector } from './EditorSelector'

export function Toolbar() {
  const { activeFileId, createFile, openFile, saveFile, closeFile, isLoading } =
    useAppStore()

  const handleSave = async () => {
    if (activeFileId) {
      await saveFile(activeFileId)
    }
  }

  const handleClose = async () => {
    if (activeFileId) {
      await closeFile(activeFileId)
    }
  }

  return (
    <div className="flex items-center gap-2 border-b p-4">
      <Button
        onClick={createFile}
        disabled={isLoading}
        variant="outline"
        size="sm"
      >
        <FilePlus />
        New
      </Button>

      <Button
        onClick={openFile}
        disabled={isLoading}
        variant="outline"
        size="sm"
      >
        <FolderOpen />
        Open
      </Button>

      <Button
        onClick={handleSave}
        disabled={isLoading || !activeFileId}
        variant="outline"
        size="sm"
      >
        <Save />
        Save
      </Button>

      <Button
        onClick={handleClose}
        disabled={isLoading || !activeFileId}
        variant="outline"
        size="sm"
      >
        <X />
        Close
      </Button>

      {/* Editor Selector */}
      {activeFileId && (
        <>
          <div className="mr-4 ml-4 h-6 w-px bg-gray-300" />
          <EditorSelector />
        </>
      )}

      {activeFileId && (
        <div className="text-muted-foreground ml-auto text-sm">
          File: {activeFileId}
        </div>
      )}
    </div>
  )
}
