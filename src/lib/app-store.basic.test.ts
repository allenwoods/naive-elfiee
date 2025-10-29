/**
 * App Store Basic Tests
 *
 * Tests for basic state management and data getters:
 * Initial state, data extraction methods, notification system
 */

import { describe, expect, test } from 'vitest'
import { useAppStore } from './app-store'
import { createMockBlock, createMockEditor, TEST_FILE_ID, TEST_BLOCK_ID, TEST_EDITOR_ID } from '@/test/setup'
import type { Block } from '@/bindings'

describe('AppStore - Basic State & Getters', () => {
  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const store = useAppStore.getState()
      
      expect(store.files).toBeInstanceOf(Map)
      expect(store.files.size).toBe(0)
      expect(store.activeFileId).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.notifications).toEqual([])
    })
  })

  describe('Data Getters', () => {
    test('getActiveFile should return null when no active file', () => {
      const store = useAppStore.getState()
      expect(store.getActiveFile()).toBeNull()
    })

    test('getActiveFile should return correct file when active', () => {
      const store = useAppStore.getState()
      const fileId = TEST_FILE_ID
      
      // Set up file state
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })
      store.activeFileId = fileId

      const activeFile = store.getActiveFile()
      expect(activeFile).not.toBeNull()
      expect(activeFile?.fileId).toBe(fileId)
    })

    test('getBlocks should return empty array for non-existent file', () => {
      const store = useAppStore.getState()
      const blocks = store.getBlocks('non-existent-file')
      expect(blocks).toEqual([])
    })

    test('getBlocks should return correct blocks for existing file', () => {
      const store = useAppStore.getState()
      const fileId = TEST_FILE_ID
      const mockBlocks = [createMockBlock(), createMockBlock({ block_id: 'block-2' })]
      
      store.files.set(fileId, {
        fileId,
        blocks: mockBlocks,
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      const blocks = store.getBlocks(fileId)
      expect(blocks).toEqual(mockBlocks)
    })

    test('getSelectedBlock should return null when no block selected', () => {
      const store = useAppStore.getState()
      const fileId = TEST_FILE_ID
      
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock()],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      const selectedBlock = store.getSelectedBlock(fileId)
      expect(selectedBlock).toBeNull()
    })

    test('getSelectedBlock should return correct block when selected', () => {
      const store = useAppStore.getState()
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID
      const mockBlock = createMockBlock({ block_id: blockId })
      
      store.files.set(fileId, {
        fileId,
        blocks: [mockBlock],
        selectedBlockId: blockId,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      const selectedBlock = store.getSelectedBlock(fileId)
      expect(selectedBlock).toEqual(mockBlock)
    })

    test('getEditors should return empty array for non-existent file', () => {
      const store = useAppStore.getState()
      const editors = store.getEditors('non-existent-file')
      expect(editors).toEqual([])
    })

    test('getEditors should return correct editors for existing file', () => {
      const store = useAppStore.getState()
      const fileId = TEST_FILE_ID
      const mockEditors = [createMockEditor(), createMockEditor({ editor_id: 'editor-2', name: 'Editor 2' })]
      
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: mockEditors,
        activeEditorId: null,
        grants: [],
        events: []
      })

      const editors = store.getEditors(fileId)
      expect(editors).toEqual(mockEditors)
    })

    test('getActiveEditor should return null when no active editor', () => {
      const store = useAppStore.getState()
      const fileId = TEST_FILE_ID
      
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [createMockEditor()],
        activeEditorId: null,
        grants: [],
        events: []
      })

      const activeEditor = store.getActiveEditor(fileId)
      expect(activeEditor).toBeNull()
    })

    test('getActiveEditor should return correct editor when active', () => {
      const store = useAppStore.getState()
      const fileId = TEST_FILE_ID
      const editorId = TEST_EDITOR_ID
      const mockEditor = createMockEditor({ editor_id: editorId })
      
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [mockEditor],
        activeEditorId: editorId,
        grants: [],
        events: []
      })

      const activeEditor = store.getActiveEditor(fileId)
      expect(activeEditor).toEqual(mockEditor)
    })

    test('getEditorName should return editor name when found', () => {
      const store = useAppStore.getState()
      const fileId = TEST_FILE_ID
      const editorId = TEST_EDITOR_ID
      const editorName = 'Test Editor'
      const mockEditor = createMockEditor({ editor_id: editorId, name: editorName })
      
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [mockEditor],
        activeEditorId: null,
        grants: [],
        events: []
      })

      const name = store.getEditorName(fileId, editorId)
      expect(name).toBe(editorName)
    })

    test('getEditorName should return editor ID when name not found', () => {
      const store = useAppStore.getState()
      const fileId = TEST_FILE_ID
      const editorId = 'unknown-editor'
      
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      const name = store.getEditorName(fileId, editorId)
      expect(name).toBe(editorId)
    })
  })

  describe('Data Extraction Methods', () => {
    test('getBlockContent should extract markdown content correctly', () => {
      const store = useAppStore.getState()
      const block: Block = {
        block_id: TEST_BLOCK_ID,
        name: 'Test Block',
        block_type: 'markdown',
        contents: { markdown: '# Hello World' },
        children: {},
        owner: TEST_EDITOR_ID
      }

      const content = store.getBlockContent(block)
      expect(content).toBe('# Hello World')
    })

    test('getBlockContent should return empty string for invalid content', () => {
      const store = useAppStore.getState()
      const block: Block = {
        block_id: TEST_BLOCK_ID,
        name: 'Test Block',
        block_type: 'markdown',
        contents: {},
        children: {},
        owner: TEST_EDITOR_ID
      }

      const content = store.getBlockContent(block)
      expect(content).toBe('')
    })

    test('getBlockContent should return empty string for non-object content', () => {
      const store = useAppStore.getState()
      const block: Block = {
        block_id: TEST_BLOCK_ID,
        name: 'Test Block',
        block_type: 'markdown',
        contents: 'invalid-content' as any,
        children: {},
        owner: TEST_EDITOR_ID
      }

      const content = store.getBlockContent(block)
      expect(content).toBe('')
    })

    test('getBlockLinks should extract links correctly', () => {
      const store = useAppStore.getState()
      const block: Block = {
        block_id: TEST_BLOCK_ID,
        name: 'Test Block',
        block_type: 'markdown',
        contents: {},
        children: {
          'references': ['block-2', 'block-3'],
          'depends_on': ['block-4'],
          'empty_relation': []
        },
        owner: TEST_EDITOR_ID
      }

      const links = store.getBlockLinks(block)
      expect(links).toEqual([
        { relation: 'references', targetIds: ['block-2', 'block-3'] },
        { relation: 'depends_on', targetIds: ['block-4'] }
      ])
    })

    test('getBlockLinks should return empty array for block with no links', () => {
      const store = useAppStore.getState()
      const block: Block = {
        block_id: TEST_BLOCK_ID,
        name: 'Test Block',
        block_type: 'markdown',
        contents: {},
        children: {},
        owner: TEST_EDITOR_ID
      }

      const links = store.getBlockLinks(block)
      expect(links).toEqual([])
    })

    test('getBlockLinks should handle null children', () => {
      const store = useAppStore.getState()
      const block: Block = {
        block_id: TEST_BLOCK_ID,
        name: 'Test Block',
        block_type: 'markdown',
        contents: {},
        children: null as any,
        owner: TEST_EDITOR_ID
      }

      const links = store.getBlockLinks(block)
      expect(links).toEqual([])
    })
  })

  describe('Notification System', () => {
    test('addNotification should add notification correctly', () => {
      const store = useAppStore.getState()
      
      store.addNotification('error', 'Test error message')
      store.addNotification('success', 'Test success message')

      // Get updated state after notifications are added
      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(2)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Test error message')
      expect(updatedStore.notifications[1].type).toBe('success')
      expect(updatedStore.notifications[1].message).toBe('Test success message')
    })

    test('addNotification should generate unique IDs', () => {
      const store = useAppStore.getState()
      
      store.addNotification('info', 'Message 1')
      store.addNotification('info', 'Message 2')

      // Get updated state after notifications are added
      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(2)
      expect(updatedStore.notifications[0].id).not.toBe(updatedStore.notifications[1].id)
    })

    test('removeNotification should remove specific notification', () => {
      const store = useAppStore.getState()
      
      store.addNotification('error', 'Error 1')
      store.addNotification('warning', 'Warning 1')
      store.addNotification('info', 'Info 1')

      // Get updated state after notifications are added
      const stateAfterAdd = useAppStore.getState()
      const notificationToRemove = stateAfterAdd.notifications[1]
      
      store.removeNotification(notificationToRemove.id)

      // Get updated state after removal
      const stateAfterRemove = useAppStore.getState()
      expect(stateAfterRemove.notifications).toHaveLength(2)
      expect(stateAfterRemove.notifications.find(n => n.id === notificationToRemove.id)).toBeUndefined()
    })

    test('clearAllNotifications should remove all notifications', () => {
      const store = useAppStore.getState()
      
      store.addNotification('error', 'Error 1')
      store.addNotification('warning', 'Warning 1')
      store.addNotification('info', 'Info 1')
      store.addNotification('success', 'Success 1')

      // Get updated state after notifications are added
      const stateAfterAdd = useAppStore.getState()
      expect(stateAfterAdd.notifications).toHaveLength(4)
      
      store.clearAllNotifications()
      
      // Get updated state after clearing
      const stateAfterClear = useAppStore.getState()
      expect(stateAfterClear.notifications).toHaveLength(0)
    })

    test('setError and clearError should manage error state', () => {
      const store = useAppStore.getState()
      
      expect(store.error).toBeNull()
      
      store.setError('Test error')
      
      // Get updated state after setting error
      const stateAfterSet = useAppStore.getState()
      expect(stateAfterSet.error).toBe('Test error')
      
      store.clearError()
      
      // Get updated state after clearing error
      const stateAfterClear = useAppStore.getState()
      expect(stateAfterClear.error).toBeNull()
    })
  })
})
