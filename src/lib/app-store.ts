/**
 * App Store - Zustand state management for Elfiee
 *
 * This store manages global application state for editor functionality.
 */

import { create } from 'zustand'
import { TauriClient } from './tauri-client'
import type { Editor } from '@/bindings'
import { toast } from 'sonner'

interface FileState {
  fileId: string
  editors: Editor[]
  activeEditorId: string | null
}

interface AppStore {
  // State
  files: Map<string, FileState>
  currentFileId: string | null

  // Editor operations
  loadEditors: (fileId: string) => Promise<void>
  setActiveEditor: (fileId: string, editorId: string) => Promise<void>
  getActiveEditor: (fileId: string) => Editor | undefined
  getEditors: (fileId: string) => Editor[]
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  files: new Map(),
  currentFileId: null,

  // Editor operations
  loadEditors: async (fileId: string) => {
    try {
      const editors = await TauriClient.editor.listEditors(fileId)
      const activeEditorId = await TauriClient.editor.getActiveEditor(fileId)

      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, editors, activeEditorId })
        set({ files })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to load editors: ${errorMessage}`)
    }
  },

  setActiveEditor: async (fileId: string, editorId: string) => {
    try {
      await TauriClient.editor.setActiveEditor(fileId, editorId)
      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, activeEditorId: editorId })
        set({ files })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to set active editor: ${errorMessage}`)
    }
  },

  getActiveEditor: (fileId: string) => {
    const fileState = get().files.get(fileId)
    if (!fileState?.activeEditorId) return undefined
    return fileState.editors.find(
      (e) => e.editor_id === fileState.activeEditorId
    )
  },

  getEditors: (fileId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.editors || []
  },
}))
