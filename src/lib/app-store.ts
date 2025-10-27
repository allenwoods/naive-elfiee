/**
 * Application State Management using Zustand
 *
 * This store manages the application state including:
 * - Currently open files
 * - Active file
 * - Blocks for the active file
 * - UI state
 */

import { create } from 'zustand'
import type { Block, Editor } from '@/bindings'
import TauriClient from './tauri-client'

interface FileState {
  fileId: string
  blocks: Block[]
  selectedBlockId: string | null
  editors: Editor[]
  activeEditorId: string | null
}

interface AppStore {
  // State
  files: Map<string, FileState>
  activeFileId: string | null
  isLoading: boolean
  error: string | null

  // File Actions
  createFile: () => Promise<void>
  openFile: () => Promise<void>
  closeFile: (fileId: string) => Promise<void>
  saveFile: (fileId: string) => Promise<void>
  setActiveFile: (fileId: string | null) => void

  // Block Actions
  loadBlocks: (fileId: string) => Promise<void>
  createBlock: (
    fileId: string,
    name: string,
    blockType?: string
  ) => Promise<void>
  updateBlock: (
    fileId: string,
    blockId: string,
    content: { type: 'text' | 'link'; data: string }
  ) => Promise<void>
  deleteBlock: (fileId: string, blockId: string) => Promise<void>
  selectBlock: (fileId: string, blockId: string | null) => void

  // Editor Actions
  loadEditors: (fileId: string) => Promise<void>
  createEditor: (fileId: string, name: string) => Promise<void>
  setActiveEditor: (fileId: string, editorId: string) => Promise<void>

  // Getters
  getActiveFile: () => FileState | null
  getBlocks: (fileId: string) => Block[]
  getSelectedBlock: (fileId: string) => Block | null
  getEditors: (fileId: string) => Editor[]
  getActiveEditor: (fileId: string) => Editor | null

  // UI Actions
  setError: (error: string | null) => void
  clearError: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial State
  files: new Map(),
  activeFileId: null,
  isLoading: false,
  error: null,

  // File Actions
  createFile: async () => {
    try {
      set({ isLoading: true, error: null })
      const fileId = await TauriClient.file.createFile()

      if (fileId) {
        const files = new Map(get().files)
        files.set(fileId, {
          fileId,
          blocks: [],
          selectedBlockId: null,
          editors: [],
          activeEditorId: null,
        })
        set({ files, activeFileId: fileId })
        await get().loadEditors(fileId)
        await get().loadBlocks(fileId)
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  openFile: async () => {
    try {
      set({ isLoading: true, error: null })
      const fileId = await TauriClient.file.openFile()

      if (fileId) {
        const files = new Map(get().files)
        files.set(fileId, {
          fileId,
          blocks: [],
          selectedBlockId: null,
          editors: [],
          activeEditorId: null,
        })
        set({ files, activeFileId: fileId })
        await get().loadEditors(fileId)
        await get().loadBlocks(fileId)
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  closeFile: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null })
      await TauriClient.file.closeFile(fileId)

      const files = new Map(get().files)
      files.delete(fileId)

      const newActiveFileId =
        get().activeFileId === fileId
          ? files.size > 0
            ? Array.from(files.keys())[0]
            : null
          : get().activeFileId

      set({ files, activeFileId: newActiveFileId })
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  saveFile: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null })
      await TauriClient.file.saveFile(fileId)
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  setActiveFile: (fileId: string | null) => {
    set({ activeFileId: fileId })
  },

  // Block Actions
  loadBlocks: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null })
      const blocks = await TauriClient.block.getAllBlocks(fileId)

      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, blocks })
        set({ files })
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  createBlock: async (
    fileId: string,
    name: string,
    blockType: string = 'markdown'
  ) => {
    console.log('[AppStore] createBlock called', { fileId, name, blockType })
    try {
      set({ isLoading: true, error: null })

      // Get active editor ID
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id

      if (!editorId) {
        throw new Error(
          'No active editor found. Please select an editor first.'
        )
      }

      const blockId = `block-${crypto.randomUUID()}`
      console.log('[AppStore] Generated blockId:', blockId)
      console.log('[AppStore] Using editor:', editorId)
      console.log('[AppStore] Calling TauriClient.block.createBlock...')
      await TauriClient.block.createBlock(
        fileId,
        blockId,
        name,
        blockType,
        editorId
      )
      console.log('[AppStore] TauriClient.block.createBlock succeeded')
      console.log('[AppStore] Loading blocks...')
      await get().loadBlocks(fileId)
      console.log('[AppStore] Blocks loaded')
    } catch (error) {
      console.error('[AppStore] createBlock error:', error)
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  updateBlock: async (
    fileId: string,
    blockId: string,
    content: { type: 'text' | 'link'; data: string }
  ) => {
    try {
      set({ isLoading: true, error: null })

      // Get active editor ID
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id

      if (!editorId) {
        throw new Error(
          'No active editor found. Please select an editor first.'
        )
      }

      await TauriClient.block.writeBlock(fileId, blockId, content, editorId)
      await get().loadBlocks(fileId)
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  deleteBlock: async (fileId: string, blockId: string) => {
    try {
      set({ isLoading: true, error: null })

      // Get active editor ID
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id

      if (!editorId) {
        throw new Error(
          'No active editor found. Please select an editor first.'
        )
      }

      await TauriClient.block.deleteBlock(fileId, blockId, editorId)
      await get().loadBlocks(fileId)
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  selectBlock: (fileId: string, blockId: string | null) => {
    const files = new Map(get().files)
    const fileState = files.get(fileId)
    if (fileState) {
      files.set(fileId, { ...fileState, selectedBlockId: blockId })
      set({ files })
    }
  },

  // Getters
  getActiveFile: () => {
    const { activeFileId, files } = get()
    return activeFileId ? files.get(activeFileId) || null : null
  },

  getBlocks: (fileId: string) => {
    return get().files.get(fileId)?.blocks || []
  },

  getSelectedBlock: (fileId: string) => {
    const fileState = get().files.get(fileId)
    if (!fileState || !fileState.selectedBlockId) return null
    return (
      fileState.blocks.find((b) => b.block_id === fileState.selectedBlockId) ||
      null
    )
  },

  getEditors: (fileId: string) => {
    return get().files.get(fileId)?.editors || []
  },

  getActiveEditor: (fileId: string) => {
    const fileState = get().files.get(fileId)
    if (!fileState || !fileState.activeEditorId) return null
    return (
      fileState.editors.find((e) => e.editor_id === fileState.activeEditorId) ||
      null
    )
  },

  getEditorName: (fileId: string, editorId: string) => {
    const editors = get().getEditors(fileId)
    const editor = editors.find((e) => e.editor_id === editorId)
    return editor?.name || editorId
  },

  // Editor Actions
  loadEditors: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null })
      const editors = await TauriClient.editor.listEditors(fileId)

      // Get active editor from backend
      const activeEditorId = await TauriClient.editor.getActiveEditor(fileId)

      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, editors, activeEditorId })
        set({ files })
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  createEditor: async (fileId: string, name: string) => {
    try {
      set({ isLoading: true, error: null })
      await TauriClient.editor.createEditor(fileId, name)
      await get().loadEditors(fileId)
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  setActiveEditor: async (fileId: string, editorId: string) => {
    try {
      set({ isLoading: true, error: null })
      await TauriClient.editor.setActiveEditor(fileId, editorId)

      // Update local state
      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, activeEditorId: editorId })
        set({ files })
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  // UI Actions
  setError: (error: string | null) => {
    set({ error })
  },

  clearError: () => {
    set({ error: null })
  },
}))
