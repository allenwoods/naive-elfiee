/**
 * EditorSelector Component
 *
 * Allows users to:
 * - View all editors for the current file
 * - Switch between editors
 * - Create new editors
 */

import { useState } from 'react'
import { useAppStore } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function EditorSelector() {
  const {
    activeFileId,
    getEditors,
    getActiveEditor,
    createEditor,
    setActiveEditor,
  } = useAppStore()
  const [isCreating, setIsCreating] = useState(false)
  const [newEditorName, setNewEditorName] = useState('')

  if (!activeFileId) {
    return null
  }

  const editors = getEditors(activeFileId)
  const activeEditor = getActiveEditor(activeFileId)

  const handleCreateEditor = async () => {
    if (!newEditorName.trim() || !activeFileId) return

    try {
      await createEditor(activeFileId, newEditorName.trim())
      setNewEditorName('')
      setIsCreating(false)
    } catch (error) {
      console.error('Failed to create editor:', error)
    }
  }

  const handleSelectEditor = async (editorId: string) => {
    if (!activeFileId) return

    const editor = editors.find((ed) => ed.editor_id === editorId)
    if (!editor) return

    try {
      await setActiveEditor(activeFileId, editor.editor_id)
    } catch (error) {
      console.error('Failed to set active editor:', error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Editor Dropdown */}
      <Select
        value={activeEditor?.editor_id || ''}
        onValueChange={handleSelectEditor}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="No editors" />
        </SelectTrigger>
        <SelectContent>
          {editors.map((editor) => (
            <SelectItem key={editor.editor_id} value={editor.editor_id}>
              {editor.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Create New Editor */}
      {!isCreating ? (
        <Button
          onClick={() => setIsCreating(true)}
          size="sm"
          title="Create new editor"
        >
          + New Editor
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={newEditorName}
            onChange={(e) => setNewEditorName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateEditor()
              } else if (e.key === 'Escape') {
                setIsCreating(false)
                setNewEditorName('')
              }
            }}
            placeholder="Editor name"
            className="w-[120px]"
            autoFocus
          />
          <Button
            onClick={handleCreateEditor}
            size="sm"
            variant="default"
          >
            Create
          </Button>
          <Button
            onClick={() => {
              setIsCreating(false)
              setNewEditorName('')
            }}
            size="sm"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
