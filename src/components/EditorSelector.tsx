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
import type { Editor } from '@/bindings'

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

  const handleSelectEditor = async (editor: Editor) => {
    if (!activeFileId) return

    try {
      await setActiveEditor(activeFileId, editor.editor_id)
    } catch (error) {
      console.error('Failed to set active editor:', error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Editor Dropdown */}
      <div className="relative">
        <select
          value={activeEditor?.editor_id || ''}
          onChange={(e) => {
            const editor = editors.find((ed) => ed.editor_id === e.target.value)
            if (editor) {
              handleSelectEditor(editor)
            }
          }}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {editors.length === 0 && <option value="">No editors</option>}
          {editors.map((editor) => (
            <option key={editor.editor_id} value={editor.editor_id}>
              {editor.name}
            </option>
          ))}
        </select>
      </div>

      {/* Create New Editor */}
      {!isCreating ? (
        <button
          onClick={() => setIsCreating(true)}
          className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          title="Create new editor"
        >
          + New Editor
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
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
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleCreateEditor}
            className="rounded bg-green-500 px-2 py-1 text-sm text-white hover:bg-green-600 focus:outline-none"
          >
            Create
          </button>
          <button
            onClick={() => {
              setIsCreating(false)
              setNewEditorName('')
            }}
            className="rounded bg-gray-500 px-2 py-1 text-sm text-white hover:bg-gray-600 focus:outline-none"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
