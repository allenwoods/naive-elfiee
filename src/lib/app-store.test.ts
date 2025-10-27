/**
 * App Store Tests
 * 
 * Tests for the Zustand application state management
 */

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { useAppStore } from './app-store'
import { mockFileOperations, mockBlockOperations, mockEditorOperations } from '@/test/tauri-mocks'
import { createMockBlock, createMockEditor, TEST_FILE_ID, TEST_BLOCK_ID, TEST_EDITOR_ID } from '@/test/setup'

// Mock TauriClient
vi.mock('./tauri-client', () => ({
  TauriClient: {
    file: {
      createFile: vi.fn(),
      openFile: vi.fn(),
      saveFile: vi.fn(),
      closeFile: vi.fn(),
    },
    block: {
      getAllBlocks: vi.fn(),
      createBlock: vi.fn(),
      writeBlock: vi.fn(),
      deleteBlock: vi.fn(),
    },
    editor: {
      listEditors: vi.fn(),
      createEditor: vi.fn(),
      setActiveEditor: vi.fn(),
      getActiveEditor: vi.fn(),
    },
  },
}))

// Mock dialog plugin
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}))

describe('AppStore', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      files: new Map(),
      activeFileId: null,
      isLoading: false,
      error: null,
    })
  })

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const state = useAppStore.getState()
      
      expect(state.files).toEqual(new Map())
      expect(state.activeFileId).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('File Operations', () => {
    test('createFile should create new file and set as active', async () => {
      const { TauriClient } = await import('./tauri-client')
      const { save } = await import('@tauri-apps/plugin-dialog')
      const mockFileId = 'new-file-1'
      
      // Mock dialog to return a file path
      vi.mocked(save).mockResolvedValue('/test/path.elf')
      vi.mocked(TauriClient.file.createFile).mockResolvedValue(mockFileId)
      vi.mocked(TauriClient.editor.listEditors).mockResolvedValue([])
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue([])
      
      await useAppStore.getState().createFile()
      
      const state = useAppStore.getState()
      expect(state.activeFileId).toBe(mockFileId)
      expect(state.files.has(mockFileId)).toBe(true)
      expect(state.files.get(mockFileId)).toEqual({
        fileId: mockFileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
      })
    })

    test('createFile should handle errors', async () => {
      const { TauriClient } = await import('./tauri-client')
      const { save } = await import('@tauri-apps/plugin-dialog')
      const errorMessage = 'Failed to create file'
      
      // Mock dialog to return a file path
      vi.mocked(save).mockResolvedValue('/test/path.elf')
      vi.mocked(TauriClient.file.createFile).mockRejectedValue(new Error(errorMessage))
      
      await useAppStore.getState().createFile()
      
      const state = useAppStore.getState()
      expect(state.error).toBe(errorMessage)
    })

    test('openFile should open file and set as active', async () => {
      const { TauriClient } = await import('./tauri-client')
      const { open } = await import('@tauri-apps/plugin-dialog')
      const mockFileId = 'opened-file-1'
      
      // Mock dialog to return a file path
      vi.mocked(open).mockResolvedValue('/test/path.elf')
      vi.mocked(TauriClient.file.openFile).mockResolvedValue(mockFileId)
      vi.mocked(TauriClient.editor.listEditors).mockResolvedValue([])
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue([])
      
      await useAppStore.getState().openFile()
      
      const state = useAppStore.getState()
      expect(state.activeFileId).toBe(mockFileId)
      expect(state.files.has(mockFileId)).toBe(true)
    })

    test('closeFile should remove file from state', async () => {
      const { TauriClient } = await import('./tauri-client')
      const { save } = await import('@tauri-apps/plugin-dialog')
      
      // First create a file
      const mockFileId = 'test-file-1'
      vi.mocked(save).mockResolvedValue('/test/path.elf')
      vi.mocked(TauriClient.file.createFile).mockResolvedValue(mockFileId)
      vi.mocked(TauriClient.editor.listEditors).mockResolvedValue([])
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue([])
      
      await useAppStore.getState().createFile()
      
      // Then close it
      vi.mocked(TauriClient.file.closeFile).mockResolvedValue(undefined)
      
      await useAppStore.getState().closeFile(mockFileId)
      
      const state = useAppStore.getState()
      expect(state.files.has(mockFileId)).toBe(false)
      expect(state.activeFileId).toBeNull()
    })

    test('saveFile should call TauriClient.saveFile', async () => {
      const { TauriClient } = await import('./tauri-client')
      
      vi.mocked(TauriClient.file.saveFile).mockResolvedValue(undefined)
      
      await useAppStore.getState().saveFile(TEST_FILE_ID)
      
      expect(TauriClient.file.saveFile).toHaveBeenCalledWith(TEST_FILE_ID)
    })

    test('setActiveFile should update activeFileId', () => {
      useAppStore.getState().setActiveFile(TEST_FILE_ID)
      
      const state = useAppStore.getState()
      expect(state.activeFileId).toBe(TEST_FILE_ID)
    })
  })

  describe('Block Operations', () => {
    beforeEach(async () => {
      // Setup a file with blocks
      const { TauriClient } = await import('./tauri-client')
      const { save } = await import('@tauri-apps/plugin-dialog')
      const mockBlocks = [createMockBlock(), createMockBlock({ block_id: 'block-2' })]
      
      vi.mocked(save).mockResolvedValue('/test/path.elf')
      vi.mocked(TauriClient.file.createFile).mockResolvedValue(TEST_FILE_ID)
      vi.mocked(TauriClient.editor.listEditors).mockResolvedValue([])
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue(mockBlocks)
      
      await useAppStore.getState().createFile()
    })

    test('loadBlocks should load blocks for file', async () => {
      const { TauriClient } = await import('./tauri-client')
      const mockBlocks = [createMockBlock(), createMockBlock({ block_id: 'block-2' })]
      
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue(mockBlocks)
      
      await useAppStore.getState().loadBlocks(TEST_FILE_ID)
      
      const state = useAppStore.getState()
      const fileState = state.files.get(TEST_FILE_ID)
      expect(fileState?.blocks).toEqual(mockBlocks)
    })

    test('createBlock should create new block', async () => {
      const { TauriClient } = await import('./tauri-client')
      const mockEvents = [{ event_id: 'event-1', entity: 'block-1', attribute: 'editor/core.create', value: {}, timestamp: {} }]
      
      vi.mocked(TauriClient.block.createBlock).mockResolvedValue(mockEvents)
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue([createMockBlock()])
      
      await useAppStore.getState().createBlock(TEST_FILE_ID, 'New Block', 'markdown')
      
      expect(TauriClient.block.createBlock).toHaveBeenCalledWith(
        TEST_FILE_ID,
        'New Block',
        'markdown',
        expect.any(String) // editor ID
      )
    })

    test('updateBlock should update block content', async () => {
      const { TauriClient } = await import('./tauri-client')
      const content = { type: 'text' as const, data: 'Updated content' }
      
      vi.mocked(TauriClient.block.writeBlock).mockResolvedValue([])
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue([createMockBlock()])
      
      await useAppStore.getState().updateBlock(TEST_FILE_ID, TEST_BLOCK_ID, content)
      
      expect(TauriClient.block.writeBlock).toHaveBeenCalledWith(
        TEST_FILE_ID,
        TEST_BLOCK_ID,
        content,
        expect.any(String) // editor ID
      )
    })

    test('deleteBlock should delete block', async () => {
      const { TauriClient } = await import('./tauri-client')
      
      vi.mocked(TauriClient.block.deleteBlock).mockResolvedValue([])
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue([])
      
      await useAppStore.getState().deleteBlock(TEST_FILE_ID, TEST_BLOCK_ID)
      
      expect(TauriClient.block.deleteBlock).toHaveBeenCalledWith(
        TEST_FILE_ID,
        TEST_BLOCK_ID,
        expect.any(String) // editor ID
      )
    })

    test('selectBlock should update selectedBlockId', () => {
      useAppStore.getState().selectBlock(TEST_FILE_ID, TEST_BLOCK_ID)
      
      const state = useAppStore.getState()
      const fileState = state.files.get(TEST_FILE_ID)
      expect(fileState?.selectedBlockId).toBe(TEST_BLOCK_ID)
    })

    test('selectBlock should clear selection when blockId is null', () => {
      useAppStore.getState().selectBlock(TEST_FILE_ID, null)
      
      const state = useAppStore.getState()
      const fileState = state.files.get(TEST_FILE_ID)
      expect(fileState?.selectedBlockId).toBeNull()
    })
  })

  describe('Editor Operations', () => {
    beforeEach(async () => {
      // Setup a file
      const { TauriClient } = await import('./tauri-client')
      const { save } = await import('@tauri-apps/plugin-dialog')
      
      vi.mocked(save).mockResolvedValue('/test/path.elf')
      vi.mocked(TauriClient.file.createFile).mockResolvedValue(TEST_FILE_ID)
      vi.mocked(TauriClient.editor.listEditors).mockResolvedValue([])
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue([])
      
      await useAppStore.getState().createFile()
    })

    test('loadEditors should load editors for file', async () => {
      const { TauriClient } = await import('./tauri-client')
      const mockEditors = [createMockEditor(), createMockEditor({ editor_id: 'editor-2' })]
      
      vi.mocked(TauriClient.editor.listEditors).mockResolvedValue(mockEditors)
      
      await useAppStore.getState().loadEditors(TEST_FILE_ID)
      
      const state = useAppStore.getState()
      const fileState = state.files.get(TEST_FILE_ID)
      expect(fileState?.editors).toEqual(mockEditors)
    })

    test('createEditor should create new editor', async () => {
      const { TauriClient } = await import('./tauri-client')
      const mockEditor = createMockEditor({ name: 'New Editor' })
      
      vi.mocked(TauriClient.editor.createEditor).mockResolvedValue(mockEditor)
      vi.mocked(TauriClient.editor.listEditors).mockResolvedValue([mockEditor])
      
      await useAppStore.getState().createEditor(TEST_FILE_ID, 'New Editor')
      
      expect(TauriClient.editor.createEditor).toHaveBeenCalledWith(TEST_FILE_ID, 'New Editor')
    })

    test('setActiveEditor should update activeEditorId', async () => {
      const { TauriClient } = await import('./tauri-client')
      
      vi.mocked(TauriClient.editor.setActiveEditor).mockResolvedValue(undefined)
      
      await useAppStore.getState().setActiveEditor(TEST_FILE_ID, TEST_EDITOR_ID)
      
      const state = useAppStore.getState()
      const fileState = state.files.get(TEST_FILE_ID)
      expect(fileState?.activeEditorId).toBe(TEST_EDITOR_ID)
    })
  })

  describe('Getters', () => {
    beforeEach(async () => {
      // Setup a file with data
      const { TauriClient } = await import('./tauri-client')
      const { save } = await import('@tauri-apps/plugin-dialog')
      const mockBlocks = [createMockBlock(), createMockBlock({ block_id: 'block-2' })]
      const mockEditors = [createMockEditor(), createMockEditor({ editor_id: 'editor-2' })]
      
      vi.mocked(save).mockResolvedValue('/test/path.elf')
      vi.mocked(TauriClient.file.createFile).mockResolvedValue(TEST_FILE_ID)
      vi.mocked(TauriClient.editor.listEditors).mockResolvedValue(mockEditors)
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue(mockBlocks)
      
      await useAppStore.getState().createFile()
      
      // Set active editor and selected block
      useAppStore.getState().setActiveEditor(TEST_FILE_ID, TEST_EDITOR_ID)
      useAppStore.getState().selectBlock(TEST_FILE_ID, TEST_BLOCK_ID)
    })

    test('getActiveFile should return active file state', () => {
      const activeFile = useAppStore.getState().getActiveFile()
      
      expect(activeFile).toBeDefined()
      expect(activeFile?.fileId).toBe(TEST_FILE_ID)
    })

    test('getActiveFile should return null when no active file', () => {
      useAppStore.getState().setActiveFile(null)
      
      const activeFile = useAppStore.getState().getActiveFile()
      expect(activeFile).toBeNull()
    })

    test('getBlocks should return blocks for file', () => {
      const blocks = useAppStore.getState().getBlocks(TEST_FILE_ID)
      
      expect(blocks).toHaveLength(2)
      expect(blocks[0].block_id).toBe('test-block-1')
    })

    test('getBlocks should return empty array for non-existent file', () => {
      const blocks = useAppStore.getState().getBlocks('non-existent-file')
      
      expect(blocks).toEqual([])
    })

    test('getSelectedBlock should return selected block', () => {
      const selectedBlock = useAppStore.getState().getSelectedBlock(TEST_FILE_ID)
      
      expect(selectedBlock).toBeDefined()
      expect(selectedBlock?.block_id).toBe(TEST_BLOCK_ID)
    })

    test('getSelectedBlock should return null when no selection', () => {
      useAppStore.getState().selectBlock(TEST_FILE_ID, null)
      
      const selectedBlock = useAppStore.getState().getSelectedBlock(TEST_FILE_ID)
      expect(selectedBlock).toBeNull()
    })

    test('getEditors should return editors for file', () => {
      const editors = useAppStore.getState().getEditors(TEST_FILE_ID)
      
      expect(editors).toHaveLength(2)
      expect(editors[0].editor_id).toBe('test-editor-1')
    })

    test('getActiveEditor should return active editor', () => {
      const activeEditor = useAppStore.getState().getActiveEditor(TEST_FILE_ID)
      
      expect(activeEditor).toBeDefined()
      expect(activeEditor?.editor_id).toBe(TEST_EDITOR_ID)
    })

    test('getActiveEditor should return null when no active editor', () => {
      useAppStore.getState().setActiveEditor(TEST_FILE_ID, 'non-existent-editor')
      
      const activeEditor = useAppStore.getState().getActiveEditor(TEST_FILE_ID)
      expect(activeEditor).toBeNull()
    })
  })

  describe('Error Handling', () => {
    test('setError should update error state', () => {
      useAppStore.getState().setError('Test error message')
      
      const state = useAppStore.getState()
      expect(state.error).toBe('Test error message')
    })

    test('clearError should clear error state', () => {
      useAppStore.getState().setError('Test error message')
      useAppStore.getState().clearError()
      
      const state = useAppStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('Loading State', () => {
    test('should set loading state during async operations', async () => {
      const { TauriClient } = await import('./tauri-client')
      const { save } = await import('@tauri-apps/plugin-dialog')
      
      // Mock dialog to return a file path
      vi.mocked(save).mockResolvedValue('/test/path.elf')
      
      // Mock a slow operation
      vi.mocked(TauriClient.file.createFile).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(TEST_FILE_ID), 100))
      )
      vi.mocked(TauriClient.editor.listEditors).mockResolvedValue([])
      vi.mocked(TauriClient.block.getAllBlocks).mockResolvedValue([])
      
      const createFilePromise = useAppStore.getState().createFile()
      
      // Check loading state is true during operation
      let state = useAppStore.getState()
      expect(state.isLoading).toBe(true)
      
      await createFilePromise
      
      // Check loading state is false after operation
      state = useAppStore.getState()
      expect(state.isLoading).toBe(false)
    })
  })
})
