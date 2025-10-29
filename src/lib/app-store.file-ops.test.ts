/**
 * App Store File Operations Tests
 *
 * Tests for file operations workflow:
 * createFile, openFile, closeFile, saveFile, setActiveFile, error handling
 */

import { describe, expect, test, beforeEach, vi } from 'vitest'
import { useAppStore } from './app-store'
import { setupCommandMocks, setupCommandError } from '@/test/mock-tauri-invoke'
import {
  createMockBlock,
  createMockEditor,
  createMockEvent,
  TEST_FILE_ID,
} from '@/test/setup'
import type { Block, Editor, Event, Grant } from '@/bindings'

describe('AppStore - File Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createFile', () => {
    test('should create file successfully and initialize state', async () => {
      const fileId = TEST_FILE_ID
      const mockEditors: Editor[] = [createMockEditor()]
      const mockBlocks: Block[] = []
      const mockGrants: Grant[] = []
      const mockEvents: Event[] = []

      // Mock dialog save method
      const { save } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(save).mockResolvedValue('/test/path.elf')

      // Mock backend commands
      setupCommandMocks({
        createFile: fileId,
        listEditors: mockEditors,
        getAllBlocks: mockBlocks,
        listGrants: mockGrants,
        getAllEvents: mockEvents,
      })

      const store = useAppStore.getState()
      await store.createFile()

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.has(fileId)).toBe(true)
      expect(updatedStore.activeFileId).toBe(fileId)
      expect(updatedStore.files.get(fileId)?.editors).toEqual(mockEditors)
      expect(updatedStore.files.get(fileId)?.blocks).toEqual(mockBlocks)
      expect(updatedStore.files.get(fileId)?.grants).toEqual(mockGrants)
      expect(updatedStore.files.get(fileId)?.events).toEqual(mockEvents)
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle user cancellation', async () => {
      // Mock dialog save method to return null (user cancelled)
      const { save } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(save).mockResolvedValue(null)

      const store = useAppStore.getState()
      await store.createFile()

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.size).toBe(0)
      expect(updatedStore.activeFileId).toBeNull()
    })

    test('should handle backend error', async () => {
      // Mock dialog save method
      const { save } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(save).mockResolvedValue('/test/path.elf')

      // Mock backend error
      setupCommandError('createFile', 'Failed to create file')

      const store = useAppStore.getState()
      await store.createFile()

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.size).toBe(0)
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe(
        'Error: Failed to create file'
      )
    })
  })

  describe('openFile', () => {
    test('should open file successfully and load data', async () => {
      const fileId = TEST_FILE_ID
      const mockEditors: Editor[] = [createMockEditor()]
      const mockBlocks: Block[] = [createMockBlock()]
      const mockGrants: Grant[] = []
      const mockEvents: Event[] = [createMockEvent()]

      // Mock dialog open method
      const { open } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(open).mockResolvedValue('/test/path.elf')

      // Mock backend commands
      setupCommandMocks({
        openFile: fileId,
        listEditors: mockEditors,
        getAllBlocks: mockBlocks,
        listGrants: mockGrants,
        getAllEvents: mockEvents,
      })

      const store = useAppStore.getState()
      await store.openFile()

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.has(fileId)).toBe(true)
      expect(updatedStore.activeFileId).toBe(fileId)
      expect(updatedStore.files.get(fileId)?.editors).toEqual(mockEditors)
      expect(updatedStore.files.get(fileId)?.blocks).toEqual(mockBlocks)
      expect(updatedStore.files.get(fileId)?.grants).toEqual(mockGrants)
      expect(updatedStore.files.get(fileId)?.events).toEqual(mockEvents)
      expect(updatedStore.isLoading).toBe(false)
    })

    test('should handle user cancellation', async () => {
      // Mock dialog open method to return null (user cancelled)
      const { open } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(open).mockResolvedValue(null)

      const store = useAppStore.getState()
      await store.openFile()

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.size).toBe(0)
      expect(updatedStore.activeFileId).toBeNull()
    })

    test('should handle backend error', async () => {
      // Mock dialog open method
      const { open } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(open).mockResolvedValue('/test/path.elf')

      // Mock backend error
      setupCommandError('openFile', 'Failed to open file')

      const store = useAppStore.getState()
      await store.openFile()

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.size).toBe(0)
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe(
        'Error: Failed to open file'
      )
    })
  })

  describe('closeFile', () => {
    test('should close file and clean up state', async () => {
      const fileId = TEST_FILE_ID
      const otherFileId = 'other-file-id'

      // Set up initial state with two files
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock()],
        selectedBlockId: null,
        editors: [createMockEditor()],
        activeEditorId: null,
        grants: [],
        events: [],
      })
      store.files.set(otherFileId, {
        fileId: otherFileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: [],
      })
      store.activeFileId = fileId

      // Mock backend command
      setupCommandMocks({
        closeFile: null,
      })

      await store.closeFile(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.has(fileId)).toBe(false)
      expect(updatedStore.files.has(otherFileId)).toBe(true)
      expect(updatedStore.activeFileId).toBe(otherFileId) // Should switch to remaining file
      expect(updatedStore.isLoading).toBe(false)
    })

    test('should set activeFileId to null when closing last file', async () => {
      const fileId = TEST_FILE_ID

      // Set up initial state with one file
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: [],
      })
      store.activeFileId = fileId

      // Mock backend command
      setupCommandMocks({
        closeFile: null,
      })

      await store.closeFile(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.size).toBe(0)
      expect(updatedStore.activeFileId).toBeNull()
    })

    test('should handle backend error', async () => {
      const fileId = TEST_FILE_ID

      // Set up initial state
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: [],
      })
      store.activeFileId = fileId

      // Mock backend error
      setupCommandError('closeFile', 'Failed to close file')

      await store.closeFile(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.has(fileId)).toBe(true) // File should still exist
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe(
        'Error: Failed to close file'
      )
    })
  })

  describe('saveFile', () => {
    test('should save file successfully', async () => {
      const fileId = TEST_FILE_ID

      // Set up initial state
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: [],
      })

      // Mock backend command
      setupCommandMocks({
        saveFile: null,
      })

      await store.saveFile(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle backend error', async () => {
      const fileId = TEST_FILE_ID

      // Set up initial state
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: [],
      })

      // Mock backend error
      setupCommandError('saveFile', 'Failed to save file')

      await store.saveFile(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe(
        'Error: Failed to save file'
      )
    })
  })

  describe('setActiveFile', () => {
    test('should set active file correctly', () => {
      const fileId = TEST_FILE_ID

      // Set up initial state
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: [],
      })

      store.setActiveFile(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.activeFileId).toBe(fileId)
    })

    test('should set active file to null', () => {
      const store = useAppStore.getState()
      store.setActiveFile(null)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.activeFileId).toBeNull()
    })
  })
})
