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
import type { Block, Editor, Grant, Event } from '@/bindings'
import TauriClient from './tauri-client'

// Concurrency control: Request version tracking for loadBlocks
// Only the most recent request updates the state
let loadBlocksRequestId = 0

// Concurrency control: Loading operation counter
// Tracks number of in-flight async operations
let loadingOperations = 0

interface FileState {
  fileId: string
  blocks: Block[]
  selectedBlockId: string | null
  editors: Editor[]
  activeEditorId: string | null
  grants: Grant[]
  events: Event[]
}

interface Notification {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  message: string
  timestamp: number
}

interface AppStore {
  // State
  files: Map<string, FileState>
  activeFileId: string | null
  isLoading: boolean
  error: string | null
  notifications: Notification[]

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

  // Grant Actions
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

  // Event Actions
  loadEvents: (fileId: string) => Promise<void>

  // Block Content Actions
  readBlockContent: (fileId: string, blockId: string) => Promise<string>
  writeBlockContent: (
    fileId: string,
    blockId: string,
    content: string
  ) => Promise<void>
  getBlockContent: (block: Block) => string

  // Block Link Actions
  linkBlocks: (
    fileId: string,
    fromId: string,
    toId: string,
    relation: string
  ) => Promise<void>
  unlinkBlocks: (
    fileId: string,
    fromId: string,
    toId: string,
    relation: string
  ) => Promise<void>
  getBlockLinks: (
    block: Block
  ) => Array<{ relation: string; targetIds: string[] }>

  // Getters
  getActiveFile: () => FileState | null
  getBlocks: (fileId: string) => Block[]
  getSelectedBlock: (fileId: string) => Block | null
  getEditors: (fileId: string) => Editor[]
  getActiveEditor: (fileId: string) => Editor | null
  getGrants: (fileId: string) => Grant[]
  getEvents: (fileId: string) => Event[]
  getEditorName: (fileId: string, editorId: string) => string

  // UI Actions
  setError: (error: string | null) => void
  clearError: () => void
  addNotification: (
    type: 'error' | 'warning' | 'info' | 'success',
    message: string
  ) => void
  removeNotification: (id: string) => void
  clearAllNotifications: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial State
  files: new Map(),
  activeFileId: null,
  isLoading: false,
  error: null,
  notifications: [],

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
          grants: [],
          events: [],
        })
        set({ files, activeFileId: fileId })
        await get().loadEditors(fileId)
        await get().loadBlocks(fileId)
        await get().loadGrants(fileId)
        await get().loadEvents(fileId)
      }
    } catch (error) {
      get().addNotification('error', String(error))
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
          grants: [],
          events: [],
        })
        set({ files, activeFileId: fileId })
        await get().loadEditors(fileId)
        await get().loadBlocks(fileId)
        await get().loadGrants(fileId)
        await get().loadEvents(fileId)
      }
    } catch (error) {
      get().addNotification('error', String(error))
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
      get().addNotification('error', String(error))
    } finally {
      set({ isLoading: false })
    }
  },

  saveFile: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null })
      await TauriClient.file.saveFile(fileId)
    } catch (error) {
      get().addNotification('error', String(error))
    } finally {
      set({ isLoading: false })
    }
  },

  setActiveFile: (fileId: string | null) => {
    set({ activeFileId: fileId })
  },

  // Block Actions
  loadBlocks: async (fileId: string) => {
    // Generate new request ID to track this specific request
    const currentRequestId = ++loadBlocksRequestId

    try {
      set({ isLoading: true, error: null })
      const blocks = await TauriClient.block.getAllBlocks(fileId)

      // ✅ Only update state if this is still the most recent request
      // Prevents slow requests from overwriting newer data
      if (currentRequestId === loadBlocksRequestId) {
        const files = new Map(get().files)
        const fileState = files.get(fileId)
        if (fileState) {
          files.set(fileId, { ...fileState, blocks })
          set({ files })
        }
      }
    } catch (error) {
      get().addNotification('error', String(error))
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
      get().addNotification('error', String(error))
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

      await TauriClient.block.writeBlock(
        fileId,
        blockId,
        content.data,
        editorId
      )
      await get().loadBlocks(fileId)
    } catch (error) {
      get().addNotification('error', String(error))
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

      // ✅ Clear selectedBlockId if deleting the currently selected block
      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState && fileState.selectedBlockId === blockId) {
        files.set(fileId, { ...fileState, selectedBlockId: null })
        set({ files })
      }

      await get().loadBlocks(fileId)
    } catch (error) {
      get().addNotification('error', String(error))
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
    console.log('[AppStore] getActiveFile:', activeFileId, files)
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
      get().addNotification('error', String(error))
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
      get().addNotification('error', String(error))
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
      get().addNotification('error', String(error))
    } finally {
      set({ isLoading: false })
    }
  },

  // Grant Actions
  loadGrants: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null })
      const grants = await TauriClient.editor.listGrants(fileId)

      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, grants })
        set({ files })
      }
    } catch (error) {
      get().addNotification('error', String(error))
    } finally {
      set({ isLoading: false })
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

      // Get active editor ID
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id

      if (!editorId) {
        throw new Error(
          'No active editor found. Please select an editor first.'
        )
      }

      await TauriClient.editor.grantCapability(
        fileId,
        targetEditor,
        capability,
        targetBlock,
        editorId
      )
      await get().loadGrants(fileId)
    } catch (error) {
      get().addNotification('error', String(error))
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

      // Get active editor ID
      const activeEditor = get().getActiveEditor(fileId)
      const editorId = activeEditor?.editor_id

      if (!editorId) {
        throw new Error(
          'No active editor found. Please select an editor first.'
        )
      }

      await TauriClient.editor.revokeCapability(
        fileId,
        targetEditor,
        capability,
        targetBlock,
        editorId
      )
      await get().loadGrants(fileId)
    } catch (error) {
      get().addNotification('error', String(error))
    } finally {
      set({ isLoading: false })
    }
  },

  // Event Actions
  loadEvents: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null })
      const events = await TauriClient.file.getAllEvents(fileId)

      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, events })
        set({ files })
      }
    } catch (error) {
      get().addNotification('error', String(error))
    } finally {
      set({ isLoading: false })
    }
  },

  // Block Content Actions
  readBlockContent: async (fileId: string, blockId: string) => {
    try {
      // For now, we can read directly from block.contents
      // In the future, might use markdown.read command
      const block = await TauriClient.block.getBlock(fileId, blockId)
      return get().getBlockContent(block)
    } catch (error) {
      get().addNotification('error', String(error))
      return ''
    }
  },

  writeBlockContent: async (
    fileId: string,
    blockId: string,
    content: string
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

      // Pass content directly as string (matches MarkdownWritePayload)
      await TauriClient.block.writeBlock(fileId, blockId, content, editorId)
      await get().loadBlocks(fileId)
    } catch (error) {
      get().addNotification('error', String(error))
    } finally {
      set({ isLoading: false })
    }
  },

  getBlockContent: (block: Block) => {
    // Extract markdown content from block.contents
    if (typeof block.contents === 'object' && block.contents !== null) {
      const contents = block.contents as Record<string, unknown>
      const markdown = contents.markdown
      if (typeof markdown === 'string') {
        return markdown
      }
    }
    return ''
  },

  // Block Link Actions
  linkBlocks: async (
    fileId: string,
    fromId: string,
    toId: string,
    relation: string
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

      await TauriClient.block.linkBlocks(
        fileId,
        fromId,
        toId,
        relation,
        editorId
      )
      await get().loadBlocks(fileId)
    } catch (error) {
      get().addNotification('error', String(error))
    } finally {
      set({ isLoading: false })
    }
  },

  unlinkBlocks: async (
    fileId: string,
    fromId: string,
    toId: string,
    relation: string
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

      await TauriClient.block.unlinkBlocks(
        fileId,
        fromId,
        toId,
        relation,
        editorId
      )
      await get().loadBlocks(fileId)
    } catch (error) {
      get().addNotification('error', String(error))
    } finally {
      set({ isLoading: false })
    }
  },

  getBlockLinks: (block: Block) => {
    // Extract links from block.children
    const links: Array<{ relation: string; targetIds: string[] }> = []
    if (block.children) {
      for (const [relation, targetIds] of Object.entries(block.children)) {
        if (targetIds && targetIds.length > 0) {
          links.push({ relation, targetIds })
        }
      }
    }
    return links
  },

  // Getters
  getGrants: (fileId: string) => {
    return get().files.get(fileId)?.grants || []
  },

  getEvents: (fileId: string) => {
    return get().files.get(fileId)?.events || []
  },

  // UI Actions
  setError: (error: string | null) => {
    set({ error })
  },

  clearError: () => {
    set({ error: null })
  },

  addNotification: (
    type: 'error' | 'warning' | 'info' | 'success',
    message: string
  ) => {
    const notification: Notification = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      message,
      timestamp: Date.now(),
    }
    set((state) => ({
      notifications: [...state.notifications, notification],
    }))
  },

  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  clearAllNotifications: () => {
    set({ notifications: [] })
  },
}))
