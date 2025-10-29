/**
 * App Store Block Operations Tests
 *
 * Tests for block operations workflow:
 * loadBlocks, createBlock, updateBlock, writeBlockContent, deleteBlock, selectBlock, readBlockContent, linkBlocks, unlinkBlocks
 */

import { describe, expect, test, beforeEach, vi } from 'vitest'
import { useAppStore } from './app-store'
import { setupCommandMocks, setupCommandError } from '@/test/mock-tauri-invoke'
import { createMockBlock, createMockEditor, createMockEvent, TEST_FILE_ID, TEST_BLOCK_ID, TEST_EDITOR_ID } from '@/test/setup'
import type { Block, Editor, Event } from '@/bindings'

describe('AppStore - Block Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadBlocks', () => {
    test('should load blocks successfully', async () => {
      const fileId = TEST_FILE_ID
      const mockBlocks: Block[] = [
        createMockBlock({ block_id: 'block-1', name: 'Block 1' }),
        createMockBlock({ block_id: 'block-2', name: 'Block 2' })
      ]

      // Set up initial state
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      // Mock backend command
      setupCommandMocks({
        getAllBlocks: mockBlocks
      })

      await store.loadBlocks(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.blocks).toEqual(mockBlocks)
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
        events: []
      })

      // Mock backend error
      setupCommandError('getAllBlocks', 'Failed to load blocks')

      await store.loadBlocks(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: Failed to load blocks')
    })
  })

  describe('createBlock', () => {
    test('should create block successfully', async () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID
      const editorId = TEST_EDITOR_ID
      const blockName = 'Test Block'
      const blockType = 'markdown'
      const mockEvents: Event[] = [createMockEvent({ entity: blockId, attribute: `${editorId}/core.create` })]

      // Set up initial state with active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [createMockEditor({ editor_id: editorId })],
        activeEditorId: editorId,
        grants: [],
        events: []
      })

      // Mock backend commands
      setupCommandMocks({
        executeCommand: mockEvents,
        getAllBlocks: [createMockBlock({ block_id: blockId, name: blockName, block_type: blockType })]
      })

      await store.createBlock(fileId, blockName, blockType)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.blocks).toHaveLength(1)
      expect(updatedStore.files.get(fileId)?.blocks[0].block_id).toBe(blockId)
      expect(updatedStore.files.get(fileId)?.blocks[0].name).toBe(blockName)
      expect(updatedStore.files.get(fileId)?.blocks[0].block_type).toBe(blockType)
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle missing active editor', async () => {
      const fileId = TEST_FILE_ID

      // Set up initial state without active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      await store.createBlock(fileId, 'Test Block')

      const updatedStore = useAppStore.getState()
      // Error should be added as notification, not in error field
      expect(updatedStore.notifications.some(n =>
        n.type === 'error' &&
        n.message.includes('No active editor found')
      )).toBe(true)
      expect(updatedStore.files.get(fileId)?.blocks).toHaveLength(0)
    })

    test('should handle backend error', async () => {
      const fileId = TEST_FILE_ID
      const editorId = TEST_EDITOR_ID

      // Set up initial state with active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [createMockEditor({ editor_id: editorId })],
        activeEditorId: editorId,
        grants: [],
        events: []
      })

      // Mock backend error
      setupCommandError('executeCommand', 'Failed to create block')

      await store.createBlock(fileId, 'Test Block')

      const updatedStore = useAppStore.getState()
      // Error should be added as notification, not in error field
      expect(updatedStore.notifications.some(n =>
        n.type === 'error' &&
        n.message.includes('Failed to create block')
      )).toBe(true)
      expect(updatedStore.files.get(fileId)?.blocks).toHaveLength(0)
    })
  })

  describe('updateBlock', () => {
    test('should update block content successfully', async () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID
      const editorId = TEST_EDITOR_ID
      const content = { type: 'text' as const, data: 'Updated content' }

      // Set up initial state with active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock({ block_id: blockId })],
        selectedBlockId: null,
        editors: [createMockEditor({ editor_id: editorId })],
        activeEditorId: editorId,
        grants: [],
        events: []
      })

      // Mock backend commands
      setupCommandMocks({
        executeCommand: [createMockEvent({ entity: blockId, attribute: `${editorId}/markdown.write` })],
        getAllBlocks: [createMockBlock({ block_id: blockId, contents: { markdown: content.data } })]
      })

      await store.updateBlock(fileId, blockId, content)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.blocks[0].contents).toEqual({ markdown: content.data })
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle missing active editor', async () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID

      // Set up initial state without active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock({ block_id: blockId })],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      await store.updateBlock(fileId, blockId, { type: 'text', data: 'Content' })

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: No active editor found. Please select an editor first.')
    })
  })

  describe('writeBlockContent', () => {
    test('should write block content successfully', async () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID
      const editorId = TEST_EDITOR_ID
      const content = 'New markdown content'

      // Set up initial state with active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock({ block_id: blockId })],
        selectedBlockId: null,
        editors: [createMockEditor({ editor_id: editorId })],
        activeEditorId: editorId,
        grants: [],
        events: []
      })

      // Mock backend commands
      setupCommandMocks({
        executeCommand: [createMockEvent({ entity: blockId, attribute: `${editorId}/markdown.write` })],
        getAllBlocks: [createMockBlock({ block_id: blockId, contents: { markdown: content } })]
      })

      await store.writeBlockContent(fileId, blockId, content)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.blocks[0].contents).toEqual({ markdown: content })
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle missing active editor', async () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID

      // Set up initial state without active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock({ block_id: blockId })],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      await store.writeBlockContent(fileId, blockId, 'Content')

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: No active editor found. Please select an editor first.')
    })
  })

  describe('deleteBlock', () => {
    test('should delete block successfully', async () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID
      const editorId = TEST_EDITOR_ID

      // Set up initial state with active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock({ block_id: blockId })],
        selectedBlockId: null,
        editors: [createMockEditor({ editor_id: editorId })],
        activeEditorId: editorId,
        grants: [],
        events: []
      })

      // Mock backend commands
      setupCommandMocks({
        executeCommand: [createMockEvent({ entity: blockId, attribute: `${editorId}/core.delete` })],
        getAllBlocks: [] // Block deleted, no blocks remaining
      })

      await store.deleteBlock(fileId, blockId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.blocks).toHaveLength(0)
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle missing active editor', async () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID

      // Set up initial state without active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock({ block_id: blockId })],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      await store.deleteBlock(fileId, blockId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: No active editor found. Please select an editor first.')
    })
  })

  describe('selectBlock', () => {
    test('should select block correctly', () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID

      // Set up initial state
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock({ block_id: blockId })],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      store.selectBlock(fileId, blockId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.selectedBlockId).toBe(blockId)
    })

    test('should deselect block when passing null', () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID

      // Set up initial state with selected block
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [createMockBlock({ block_id: blockId })],
        selectedBlockId: blockId,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      store.selectBlock(fileId, null)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.selectedBlockId).toBeNull()
    })
  })

  describe('readBlockContent', () => {
    test('should read block content successfully', async () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID
      const content = '# Hello World'

      // Mock backend command
      setupCommandMocks({
        getBlock: createMockBlock({ 
          block_id: blockId, 
          contents: { markdown: content } 
        })
      })

      const store = useAppStore.getState()
      const result = await store.readBlockContent(fileId, blockId)

      expect(result).toBe(content)
    })

    test('should handle backend error', async () => {
      const fileId = TEST_FILE_ID
      const blockId = TEST_BLOCK_ID

      // Mock backend error
      setupCommandError('getBlock', 'Failed to read block')

      const store = useAppStore.getState()
      const result = await store.readBlockContent(fileId, blockId)

      expect(result).toBe('')
      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: Failed to read block')
    })
  })

  describe('linkBlocks', () => {
    test('should link blocks successfully', async () => {
      const fileId = TEST_FILE_ID
      const fromId = 'block-1'
      const toId = 'block-2'
      const relation = 'references'
      const editorId = TEST_EDITOR_ID

      // Set up initial state with active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [
          createMockBlock({ block_id: fromId }),
          createMockBlock({ block_id: toId })
        ],
        selectedBlockId: null,
        editors: [createMockEditor({ editor_id: editorId })],
        activeEditorId: editorId,
        grants: [],
        events: []
      })

      // Mock backend commands
      setupCommandMocks({
        executeCommand: [createMockEvent({ entity: fromId, attribute: `${editorId}/core.link` })],
        getAllBlocks: [
          createMockBlock({ 
            block_id: fromId, 
            children: { [relation]: [toId] } 
          }),
          createMockBlock({ block_id: toId })
        ]
      })

      await store.linkBlocks(fileId, fromId, toId, relation)

      const updatedStore = useAppStore.getState()
      const fromBlock = updatedStore.files.get(fileId)?.blocks.find(b => b.block_id === fromId)
      expect(fromBlock?.children?.[relation]).toContain(toId)
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle missing active editor', async () => {
      const fileId = TEST_FILE_ID
      const fromId = 'block-1'
      const toId = 'block-2'
      const relation = 'references'

      // Set up initial state without active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [
          createMockBlock({ block_id: fromId }),
          createMockBlock({ block_id: toId })
        ],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      await store.linkBlocks(fileId, fromId, toId, relation)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: No active editor found. Please select an editor first.')
    })
  })

  describe('unlinkBlocks', () => {
    test('should unlink blocks successfully', async () => {
      const fileId = TEST_FILE_ID
      const fromId = 'block-1'
      const toId = 'block-2'
      const relation = 'references'
      const editorId = TEST_EDITOR_ID

      // Set up initial state with active editor and existing link
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [
          createMockBlock({ 
            block_id: fromId, 
            children: { [relation]: [toId] } 
          }),
          createMockBlock({ block_id: toId })
        ],
        selectedBlockId: null,
        editors: [createMockEditor({ editor_id: editorId })],
        activeEditorId: editorId,
        grants: [],
        events: []
      })

      // Mock backend commands
      setupCommandMocks({
        executeCommand: [createMockEvent({ entity: fromId, attribute: `${editorId}/core.unlink` })],
        getAllBlocks: [
          createMockBlock({ 
            block_id: fromId, 
            children: {} // Link removed
          }),
          createMockBlock({ block_id: toId })
        ]
      })

      await store.unlinkBlocks(fileId, fromId, toId, relation)

      const updatedStore = useAppStore.getState()
      const fromBlock = updatedStore.files.get(fileId)?.blocks.find(b => b.block_id === fromId)
      expect(fromBlock?.children?.[relation] || []).not.toContain(toId)
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle missing active editor', async () => {
      const fileId = TEST_FILE_ID
      const fromId = 'block-1'
      const toId = 'block-2'
      const relation = 'references'

      // Set up initial state without active editor
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [
          createMockBlock({ 
            block_id: fromId, 
            children: { [relation]: [toId] } 
          }),
          createMockBlock({ block_id: toId })
        ],
        selectedBlockId: null,
        editors: [],
        activeEditorId: null,
        grants: [],
        events: []
      })

      await store.unlinkBlocks(fileId, fromId, toId, relation)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: No active editor found. Please select an editor first.')
    })
  })
})
