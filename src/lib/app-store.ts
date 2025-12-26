/**
 * App Store - Zustand state management for Elfiee
 *
 * This store manages global application state for editor functionality.
 */

import { create } from 'zustand'
import { TauriClient } from './tauri-client'
import type { Editor, Block, FileMetadata, Event, Grant } from '@/bindings'
import { toast } from 'sonner'
import {
  buildTreeFromEntries,
  type VfsNode,
  type DirectoryEntry,
} from '@/utils/vfs-tree'

interface FileState {
  fileId: string
  metadata: FileMetadata | null
  editors: Editor[]
  activeEditorId: string | null
  blocks: Block[]
  selectedBlockId: string | null
  events: Event[]
  grants: Grant[]
}

interface AppStore {
  // State
  files: Map<string, FileState>
  currentFileId: string | null

  // File operations
  openFile: (path: string) => Promise<string>
  setCurrentFile: (fileId: string | null) => void
  getFileMetadata: (fileId: string) => FileMetadata | null
  getAllFiles: () => string[]
  initializeOpenFiles: () => Promise<void>
  saveFile: (fileId: string) => Promise<void>

  // Block operations
  loadBlocks: (fileId: string) => Promise<void>
  getBlocks: (fileId: string) => Block[]
  getBlock: (fileId: string, blockId: string) => Block | undefined
  selectBlock: (blockId: string) => void
  updateBlock: (
    fileId: string,
    blockId: string,
    content: string,
    blockType?: string
  ) => Promise<void>
  createBlock: (
    fileId: string,
    name: string,
    blockType: string
  ) => Promise<void>
  deleteBlock: (fileId: string, blockId: string) => Promise<void>
  renameBlock: (
    fileId: string,
    blockId: string,
    newName: string
  ) => Promise<void>
  updateBlockMetadata: (
    fileId: string,
    blockId: string,
    metadata: Record<string, unknown>
  ) => Promise<void>

  // Directory/VFS operations
  getOutlineTree: (fileId: string) => VfsNode[]
  getLinkedRepos: (
    fileId: string
  ) => { blockId: string; name: string; tree: VfsNode[] }[]
  ensureSystemOutline: (fileId: string) => Promise<void>

  // Editor operations
  loadEditors: (fileId: string) => Promise<void>
  createEditor: (
    fileId: string,
    name: string,
    editorType?: string,
    blockId?: string
  ) => Promise<Editor>
  deleteEditor: (
    fileId: string,
    editorId: string,
    blockId?: string
  ) => Promise<void>
  setActiveEditor: (fileId: string, editorId: string) => Promise<void>
  getActiveEditor: (fileId: string) => Editor | undefined
  getEditors: (fileId: string) => Editor[]

  // Event and Grant operations
  getEvents: (fileId: string) => Event[]
  loadEvents: (fileId: string) => Promise<void>
  restoreToEvent: (
    fileId: string,
    blockId: string,
    eventId: string
  ) => Promise<void>
  getGrants: (fileId: string) => Grant[]
  getBlockGrants: (fileId: string, blockId: string) => Grant[]
  loadGrants: (fileId: string) => Promise<void>
  grantCapability: (
    fileId: string,
    targetEditor: string,
    capability: string,
    targetBlock?: string,
    granterEditorId?: string
  ) => Promise<void>
  revokeCapability: (
    fileId: string,
    targetEditor: string,
    capability: string,
    targetBlock?: string
  ) => Promise<void>

  // Computed state
  selectedBlockId: string | null
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  files: new Map(),
  currentFileId: null,
  selectedBlockId: null,

  // File operations
  openFile: async (path: string) => {
    try {
      const fileId = await TauriClient.file.openFile(path)
      const metadata = await TauriClient.file.getFileInfo(fileId)

      const files = new Map(get().files)
      files.set(fileId, {
        fileId,
        metadata,
        editors: [],
        activeEditorId: null,
        blocks: [],
        selectedBlockId: null,
        events: [],
        grants: [],
      })

      set({ files, currentFileId: fileId })

      // Load blocks, editors, and grants
      await get().loadBlocks(fileId)
      await get().loadEditors(fileId)
      await get().loadGrants(fileId)

      return fileId
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to open file: ${errorMessage}`)
      throw error
    }
  },

  setCurrentFile: (fileId: string | null) => {
    set({ currentFileId: fileId })
  },

  getFileMetadata: (fileId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.metadata || null
  },

  getAllFiles: () => {
    return Array.from(get().files.keys())
  },

  initializeOpenFiles: async () => {
    try {
      // Get all open files from backend
      const fileIds = await TauriClient.file.listOpenFiles()

      // Load metadata and editors for each file
      const files = new Map(get().files)

      for (const fileId of fileIds) {
        // Skip if already loaded
        if (files.has(fileId)) continue

        // Get file metadata
        const metadata = await TauriClient.file.getFileInfo(fileId)

        // Initialize file state
        files.set(fileId, {
          fileId,
          metadata,
          editors: [],
          activeEditorId: null,
          blocks: [],
          selectedBlockId: null,
          events: [],
          grants: [],
        })
      }

      set({ files })

      // Load editors for each file
      for (const fileId of fileIds) {
        await get().loadEditors(fileId)
      }
    } catch (error) {
      console.error('Failed to initialize open files:', error)
      // Don't show toast on initialization failure - this is background work
    }
  },

  saveFile: async (fileId: string) => {
    try {
      await TauriClient.file.saveFile(fileId)
      // Note: Success toast is handled by the caller (EditorCanvas) to avoid duplicate messages
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to save file: ${errorMessage}`)
      throw error
    }
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

  getBlocks: (fileId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.blocks || []
  },

  getBlock: (fileId: string, blockId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.blocks.find((b) => b.block_id === blockId)
  },

  selectBlock: (blockId: string) => {
    const currentFileId = get().currentFileId
    if (!currentFileId) return

    const files = new Map(get().files)
    const fileState = files.get(currentFileId)
    if (fileState) {
      files.set(currentFileId, { ...fileState, selectedBlockId: blockId })
      set({ files, selectedBlockId: blockId })
    }
  },

  updateBlock: async (
    fileId: string,
    blockId: string,
    content: string,
    blockType: string = 'markdown'
  ) => {
    try {
      await TauriClient.block.writeBlock(fileId, blockId, content, blockType)
      // Reload blocks to get the updated content
      await get().loadBlocks(fileId)
      // Note: Success toast is handled by the caller (EditorCanvas) to avoid duplicate messages
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to update block: ${errorMessage}`)
      throw error
    }
  },

  createBlock: async (fileId: string, name: string, blockType: string) => {
    try {
      await TauriClient.block.createBlock(fileId, name, blockType)
      // Reload blocks to get the new block
      await get().loadBlocks(fileId)
      toast.success('Block created successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to create block: ${errorMessage}`)
      throw error
    }
  },

  deleteBlock: async (fileId: string, blockId: string) => {
    try {
      await TauriClient.block.deleteBlock(fileId, blockId)
      // Reload blocks to reflect the deletion
      await get().loadBlocks(fileId)
      toast.success('Block deleted successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to delete block: ${errorMessage}`)
      throw error
    }
  },

  renameBlock: async (fileId: string, blockId: string, newName: string) => {
    try {
      await TauriClient.block.renameBlock(fileId, blockId, newName)
      await get().loadBlocks(fileId)
      toast.success('Block renamed successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to rename block: ${errorMessage}`)
      throw error
    }
  },

  updateBlockMetadata: async (
    fileId: string,
    blockId: string,
    metadata: Record<string, unknown>
  ) => {
    try {
      // Use the new update_block_metadata Tauri command
      await TauriClient.block.updateBlockMetadata(fileId, blockId, metadata)

      // TODO: Performance optimization - Currently reloading ALL blocks just to update one block's metadata.
      // Consider: 1) Backend returning the updated block, or 2) Optimistic update pattern
      // This causes unnecessary overhead when file has many blocks.
      await get().loadBlocks(fileId)

      toast.success('Metadata updated successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to update metadata: ${errorMessage}`)
      throw error
    }
  },

  // Directory/VFS operations
  getOutlineTree: (fileId: string) => {
    const blocks = get().getBlocks(fileId)
    // 1. Find the system outline by source='outline'
    // We take the first directory block marked as outline source
    const outlineBlock = blocks.find(
      (b) =>
        b.block_type === 'directory' &&
        (b.contents as any)?.source === 'outline'
    )

    if (!outlineBlock) return []

    const contents = outlineBlock.contents as {
      entries?: Record<string, DirectoryEntry>
    }

    return buildTreeFromEntries(contents.entries || {}, blocks)
  },

  getLinkedRepos: (fileId: string) => {
    const blocks = get().getBlocks(fileId)
    // Filter: directory blocks with source='linked'
    const directoryBlocks = blocks.filter(
      (b) =>
        b.block_type === 'directory' && (b.contents as any)?.source === 'linked'
    )

    return directoryBlocks.map((block) => {
      const contents = block.contents as {
        entries?: Record<string, DirectoryEntry>
      }
      return {
        blockId: block.block_id,
        name: block.name,
        tree: buildTreeFromEntries(contents.entries || {}, blocks),
      }
    })
  },

  ensureSystemOutline: async (fileId: string) => {
    const blocks = get().getBlocks(fileId)
    const hasOutline = blocks.some(
      (b) =>
        b.block_type === 'directory' &&
        (b.contents as any)?.source === 'outline'
    )

    if (!hasOutline) {
      try {
        const systemEditorId = await TauriClient.file.getSystemEditorId()
        // Create Outline directory block
        // ID is auto-generated, Name is 'Outline' but only for display
        await TauriClient.block.createBlock(
          fileId,
          'Outline',
          'directory',
          systemEditorId
        )
        // Note: backend createBlock defaults source to 'outline', so we are good.

        await get().loadBlocks(fileId)
      } catch (error) {
        console.error('Failed to initialize system outline:', error)
      }
    }
  },

  // Editor operations
  loadEditors: async (fileId: string) => {
    try {
      const editors = await TauriClient.editor.listEditors(fileId)
      let activeEditorId = await TauriClient.editor.getActiveEditor(fileId)

      // Validate activeEditorId - if it doesn't exist in editors list, reset to first editor
      if (
        activeEditorId &&
        !editors.some((e) => e.editor_id === activeEditorId)
      ) {
        console.warn(
          `Active editor ${activeEditorId} not found in editors list. Resetting to first editor.`
        )
        if (editors.length > 0) {
          // Prefer System editor, otherwise use first editor
          const systemEditor = editors.find((e) => e.name === 'System')
          activeEditorId = systemEditor
            ? systemEditor.editor_id
            : editors[0].editor_id
          // Update backend active editor
          await TauriClient.editor.setActiveEditor(fileId, activeEditorId)
        } else {
          activeEditorId = null
        }
      }

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

  createEditor: async (
    fileId: string,
    name: string,
    editorType?: string,
    blockId?: string
  ) => {
    try {
      const newEditor = await TauriClient.editor.createEditor(
        fileId,
        name,
        editorType,
        blockId
      )
      // Reload editors to get the updated list
      await get().loadEditors(fileId)
      toast.success(`User "${name}" created successfully`)
      return newEditor
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to create user: ${errorMessage}`)
      throw error
    }
  },

  deleteEditor: async (fileId: string, editorId: string, blockId?: string) => {
    try {
      await TauriClient.editor.deleteEditor(fileId, editorId, blockId)
      // Reload editors to get the updated list
      await get().loadEditors(fileId)
      // Also reload grants since deleting an editor removes all their grants
      await get().loadGrants(fileId)
      toast.success('Collaborator removed successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to remove collaborator: ${errorMessage}`)
      throw error
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

  // Event and Grant operations
  getEvents: (fileId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.events || []
  },

  loadEvents: async (fileId: string) => {
    try {
      const events = await TauriClient.event.getAllEvents(fileId)
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

  /**
   * 回溯到指定事件时刻的内容
   * 直接替换编辑器内容，用户可继续编辑和保存
   */
  restoreToEvent: async (fileId: string, blockId: string, eventId: string) => {
    try {
      // 1. 获取历史状态 (包含 name, content, metadata 以及权限 grants 等)
      const { block: historicalBlock, grants: historicalGrants } =
        await TauriClient.event.getStateAtEvent(fileId, blockId, eventId)

      // 2. 更新当前 block 的状态和权限（仅在内存中，不保存到数据库）
      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        // 更新 blocks
        const updatedBlocks = fileState.blocks.map((block) => {
          if (block.block_id === blockId) {
            // 完整替换 block 状态，恢复 name, content 和 metadata
            return {
              ...historicalBlock,
            }
          }
          return block
        })

        // 更新 fileState，同时包含新的 grants
        files.set(fileId, {
          ...fileState,
          blocks: updatedBlocks,
          grants: historicalGrants,
        })
        set({ files })
      }

      // 3. 触发通知
      toast.success('已恢复到历史快照，包含描述、标题和权限')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to restore: ${errorMessage}`)
      throw error
    }
  },

  getGrants: (fileId: string) => {
    const fileState = get().files.get(fileId)
    return fileState?.grants || []
  },

  getBlockGrants: (fileId: string, blockId: string) => {
    const fileState = get().files.get(fileId)
    if (!fileState) return []
    return fileState.grants.filter(
      (g) => g.block_id === blockId || g.block_id === '*'
    )
  },

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
    targetBlock: string = '*',
    granterEditorId?: string
  ) => {
    try {
      await TauriClient.editor.grantCapability(
        fileId,
        targetEditor,
        capability,
        targetBlock,
        granterEditorId
      )
      // Reload grants and events to update UI
      await get().loadGrants(fileId)
      await get().loadEvents(fileId)
      toast.success('Permission granted')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to grant permission: ${errorMessage}`)
      throw error
    }
  },

  revokeCapability: async (
    fileId: string,
    targetEditor: string,
    capability: string,
    targetBlock: string = '*'
  ) => {
    try {
      await TauriClient.editor.revokeCapability(
        fileId,
        targetEditor,
        capability,
        targetBlock
      )
      // Reload grants and events to update UI
      await get().loadGrants(fileId)
      await get().loadEvents(fileId)
      toast.success('Permission revoked')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`Failed to revoke permission: ${errorMessage}`)
      throw error
    }
  },
}))
