/**
 * App Store - Zustand state management for Elfiee
 *
 * This store manages global application state and provides actions
 * to interact with the Tauri backend.
 */

import { create } from 'zustand'
import { TauriClient } from './tauri-client'
import type { Block, Editor, Event, Grant } from '@/bindings'
import { toast } from 'sonner'

interface FileState {
  fileId: string
  blocks: Block[]
  editors: Editor[]
  grants: Grant[]
  events: Event[]
  activeEditorId: string | null
}

interface AppStore {
  // State
  files: Map<string, FileState>
  currentFileId: string | null
  selectedBlockId: string | null
  isLoading: boolean
  error: string | null

  // File operations
  openFile: (path: string) => Promise<void>
  createFile: (path: string) => Promise<void>
  closeFile: (fileId: string) => Promise<void>
  setCurrentFile: (fileId: string | null) => void

  // Block operations
  loadBlocks: (fileId: string) => Promise<void>
  createBlock: (
    fileId: string,
    name: string,
    blockType: string
  ) => Promise<void>
  updateBlock: (
    fileId: string,
    blockId: string,
    content: string
  ) => Promise<void>
  deleteBlock: (fileId: string, blockId: string) => Promise<void>
  selectBlock: (blockId: string | null) => void
  getBlock: (fileId: string, blockId: string) => Block | undefined
  getBlocks: (fileId: string) => Block[]

  // Editor operations
  loadEditors: (fileId: string) => Promise<void>
  createEditor: (fileId: string, name: string) => Promise<void>
  setActiveEditor: (fileId: string, editorId: string) => Promise<void>
  getActiveEditor: (fileId: string) => Editor | undefined
  getEditors: (fileId: string) => Editor[]

  // Grant operations
  loadGrants: (fileId: string) => Promise<void>
  grantCapability: (
    fileId: string,
    targetEditor: string,
    capability: string,
    targetBlock?: string
  ) => Promise<void>
  revokeCapability: (
    fileId: string,
    targetEditor: string,
    capability: string,
    targetBlock?: string
  ) => Promise<void>
  getGrants: (fileId: string) => Grant[]

  // Event operations
  loadEvents: (fileId: string) => Promise<void>
  getEvents: (fileId: string) => Event[]
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  files: new Map(),
  currentFileId: null,
  selectedBlockId: null,
  isLoading: false,
  error: null,

  // File operations
  openFile: async (path: string) => {
    try {
      set({ isLoading: true, error: null })
      const fileId = await TauriClient.file.openFile(path)

      const files = new Map(get().files)
      files.set(fileId, {
        fileId,
        blocks: [],
        editors: [],
        grants: [],
        events: [],
        activeEditorId: null,
      })

      set({ files, currentFileId: fileId })

      // Load initial data
      await get().loadBlocks(fileId)
      await get().loadEditors(fileId)
      await get().loadGrants(fileId)
      await get().loadEvents(fileId)

      toast.success('File opened successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      set({ error: errorMessage })
      toast.error(`Failed to open file: ${errorMessage}`)
    } finally {
      set({ isLoading: false })
    }
  },

  createFile: async (path: string) => {
    try {
      set({ isLoading: true, error: null })
      const fileId = await TauriClient.file.createFile(path)

      const files = new Map(get().files)
      files.set(fileId, {
        fileId,
        blocks: [],
        editors: [],
        grants: [],
        events: [],
        activeEditorId: null,
      })

      set({ files, currentFileId: fileId })
      toast.success('File created successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      set({ error: errorMessage })
      toast.error(`Failed to create file: ${errorMessage}`)
    } finally {
      set({ isLoading: false })
    }
  },

  closeFile: async (fileId: string) => {
    try {
      await TauriClient.file.closeFile(fileId)
      const files = new Map(get().files)
      files.delete(fileId)

      const currentFileId =
        get().currentFileId === fileId ? null : get().currentFileId
      set({ files, currentFileId })
      toast.success('File closed')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to close file: ${errorMessage}`)
    }
  },

  setCurrentFile: (fileId: string | null) => {
    set({ currentFileId: fileId, selectedBlockId: null })
  },

  // Block operations
  loadBlocks: async (fileId: string) => {
    try {
      const blocks = await TauriClient.block.getAllBlocks(fileId)
      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, blocks })
        set({ files })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to load blocks: ${errorMessage}`)
    }
  },

  createBlock: async (fileId: string, name: string, blockType: string) => {
    try {
      set({ isLoading: true, error: null })
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id || 'default-editor'

      await TauriClient.block.createBlock(fileId, name, blockType, editorId)
      await get().loadBlocks(fileId)
      toast.success('Block created')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to create block: ${errorMessage}`)
    } finally {
      set({ isLoading: false })
    }
  },

  updateBlock: async (fileId: string, blockId: string, content: string) => {
    try {
      set({ isLoading: true, error: null })
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id || 'default-editor'

      await TauriClient.block.writeBlock(fileId, blockId, content, editorId)
      await get().loadBlocks(fileId)
      await get().loadEvents(fileId)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to update block: ${errorMessage}`)
    } finally {
      set({ isLoading: false })
    }
  },

  deleteBlock: async (fileId: string, blockId: string) => {
    try {
      set({ isLoading: true, error: null })
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id || 'default-editor'

      await TauriClient.block.deleteBlock(fileId, blockId, editorId)
      await get().loadBlocks(fileId)

      if (get().selectedBlockId === blockId) {
        set({ selectedBlockId: null })
      }
      toast.success('Block deleted')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to delete block: ${errorMessage}`)
    } finally {
      set({ isLoading: false })
    }
  },

  selectBlock: (blockId: string | null) => {
    set({ selectedBlockId: blockId })
  },

  getBlock: (fileId: string, blockId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.blocks.find((b) => b.block_id === blockId)
  },

  getBlocks: (fileId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.blocks || []
  },

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

  createEditor: async (fileId: string, name: string) => {
    try {
      await TauriClient.editor.createEditor(fileId, name)
      await get().loadEditors(fileId)
      toast.success('Editor created')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to create editor: ${errorMessage}`)
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

  // Grant operations
  loadGrants: async (fileId: string) => {
    try {
      const grants = await TauriClient.editor.listGrants(fileId)
      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, grants })
        set({ files })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to load grants: ${errorMessage}`)
    }
  },

  grantCapability: async (
    fileId: string,
    targetEditor: string,
    capability: string,
    targetBlock: string = '*'
  ) => {
    try {
      set({ isLoading: true, error: null })
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id || 'default-editor'

      await TauriClient.editor.grantCapability(
        fileId,
        targetEditor,
        capability,
        targetBlock,
        editorId
      )
      await get().loadGrants(fileId)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to grant capability: ${errorMessage}`)
    } finally {
      set({ isLoading: false })
    }
  },

  revokeCapability: async (
    fileId: string,
    targetEditor: string,
    capability: string,
    targetBlock: string = '*'
  ) => {
    try {
      set({ isLoading: true, error: null })
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id || 'default-editor'

      await TauriClient.editor.revokeCapability(
        fileId,
        targetEditor,
        capability,
        targetBlock,
        editorId
      )
      await get().loadGrants(fileId)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to revoke capability: ${errorMessage}`)
    } finally {
      set({ isLoading: false })
    }
  },

  getGrants: (fileId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.grants || []
  },

  // Event operations
  loadEvents: async (fileId: string) => {
    try {
      const events = await TauriClient.file.getAllEvents(fileId)
      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, events })
        set({ files })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to load events: ${errorMessage}`)
    }
  },

  getEvents: (fileId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.events || []
  },
}))
