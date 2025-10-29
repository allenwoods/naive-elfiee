/**
 * App Store Concurrency Tests
 *
 * Tests for race conditions and concurrent operations.
 * These tests expose real concurrency bugs that need to be fixed in app-store.ts
 */

import { describe, expect, test, beforeEach, vi } from 'vitest'
import { useAppStore } from './app-store'
import { setupCommandMocks } from '@/test/mock-tauri-invoke'
import {
  createMockBlock,
  createMockEditor,
  createMockEvent,
  TEST_FILE_ID,
  TEST_EDITOR_ID,
} from '@/test/setup'
import type { Block, Editor, Event } from '@/bindings'
import { invoke } from '@tauri-apps/api/core'

describe('AppStore - Concurrency Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Concurrent Block Creation', () => {
    test('should handle rapid consecutive block creations correctly', async () => {
      const fileId = TEST_FILE_ID
      const mockEditor = createMockEditor({ editor_id: TEST_EDITOR_ID })
      const mockEvents = [createMockEvent()]

      // Initialize file state
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [mockEditor],
        activeEditorId: TEST_EDITOR_ID,
        grants: [],
        events: [],
      })

      let getAllBlocksCallCount = 0

      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'execute_command') {
          return mockEvents
        }
        if (cmd === 'get_all_blocks') {
          getAllBlocksCallCount++
          // Return incrementally more blocks as they are created
          return Array.from({ length: getAllBlocksCallCount }, (_, i) =>
            createMockBlock({
              block_id: `block-${i + 1}`,
              name: `Block ${i + 1}`,
            })
          )
        }
        return null
      })

      // Create 3 blocks rapidly without waiting
      const creationPromises = [
        store.createBlock(fileId, 'Block 1', 'markdown'),
        store.createBlock(fileId, 'Block 2', 'markdown'),
        store.createBlock(fileId, 'Block 3', 'markdown'),
      ]

      await Promise.all(creationPromises)

      // Verify: getAllBlocks should have been called 3 times
      expect(getAllBlocksCallCount).toBe(3)

      // Verify: Final state should contain all 3 blocks
      const finalStore = useAppStore.getState()
      const finalBlocks = finalStore.files.get(fileId)?.blocks
      expect(finalBlocks).toHaveLength(3)
    })
  })

  describe('Concurrent State Updates', () => {
    test('should handle simultaneous block selection and deletion', async () => {
      const fileId = TEST_FILE_ID
      const blockId = 'block-to-delete'
      const mockBlock = createMockBlock({ block_id: blockId })
      const mockEditor = createMockEditor({ editor_id: TEST_EDITOR_ID })
      const mockEvents = [createMockEvent()]

      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [mockBlock],
        selectedBlockId: null,
        editors: [mockEditor],
        activeEditorId: TEST_EDITOR_ID,
        grants: [],
        events: [],
      })

      setupCommandMocks({
        executeCommand: mockEvents,
        getAllBlocks: [], // After deletion, no blocks remain
      })

      // Simulate: User selects block, then immediately deletes it
      store.selectBlock(fileId, blockId)

      // Verify block is selected
      let currentStore = useAppStore.getState()
      expect(currentStore.files.get(fileId)?.selectedBlockId).toBe(blockId)

      // Delete the block
      await store.deleteBlock(fileId, blockId)

      // After deletion, selectedBlockId should be cleared
      currentStore = useAppStore.getState()

      // STRICT: selectedBlockId must be null after deleting selected block
      expect(currentStore.files.get(fileId)?.selectedBlockId).toBeNull()
      expect(currentStore.getSelectedBlock(fileId)).toBeNull()
    })

    test('should handle multiple loadBlocks calls - newest data wins', async () => {
      const fileId = TEST_FILE_ID
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

      // Simulate different response times
      const blocks1 = [createMockBlock({ block_id: 'old-block-1' })]
      const blocks2 = [
        createMockBlock({ block_id: 'new-block-1' }),
        createMockBlock({ block_id: 'new-block-2' }),
      ]
      const blocks3 = [
        createMockBlock({ block_id: 'newest-block-1' }),
        createMockBlock({ block_id: 'newest-block-2' }),
        createMockBlock({ block_id: 'newest-block-3' }),
      ]

      let callCount = 0
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'get_all_blocks') {
          callCount++

          // First call: slow (200ms) - returns old data
          if (callCount === 1) {
            await new Promise((resolve) => setTimeout(resolve, 200))
            return blocks1
          }
          // Second call: medium (100ms) - returns newer data
          if (callCount === 2) {
            await new Promise((resolve) => setTimeout(resolve, 100))
            return blocks2
          }
          // Third call: fast (50ms) - returns NEWEST data
          if (callCount === 3) {
            await new Promise((resolve) => setTimeout(resolve, 50))
            return blocks3
          }
        }
        return null
      })

      // Start all three loads concurrently
      await Promise.all([
        store.loadBlocks(fileId),
        store.loadBlocks(fileId),
        store.loadBlocks(fileId),
      ])

      const finalStore = useAppStore.getState()
      const finalBlocks = finalStore.files.get(fileId)?.blocks

      // STRICT: The newest request (call #3) should win, not the slowest
      // Expected: blocks3 (3 blocks)
      // Current buggy behavior: blocks1 (1 block) - the slowest request wins
      expect(finalBlocks).toHaveLength(3)
      expect(finalBlocks?.[0].block_id).toBe('newest-block-1')
      expect(finalBlocks?.[1].block_id).toBe('newest-block-2')
      expect(finalBlocks?.[2].block_id).toBe('newest-block-3')
    })
  })

  describe('Error Handling During Concurrent Operations', () => {
    test('should handle partial failures in concurrent block creations', async () => {
      const fileId = TEST_FILE_ID
      const mockEditor = createMockEditor({ editor_id: TEST_EDITOR_ID })

      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [mockEditor],
        activeEditorId: TEST_EDITOR_ID,
        grants: [],
        events: [],
      })

      let callCount = 0
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'execute_command') {
          callCount++
          // First call succeeds
          if (callCount === 1) {
            return [createMockEvent()]
          }
          // Second call fails
          if (callCount === 2) {
            throw new Error('Network error')
          }
          // Third call succeeds
          if (callCount === 3) {
            return [createMockEvent()]
          }
        }
        if (cmd === 'get_all_blocks') {
          // Return blocks based on successful creations (1st and 3rd)
          return [
            createMockBlock({ block_id: 'block-1' }),
            createMockBlock({ block_id: 'block-3' }),
          ]
        }
        return null
      })

      // Create 3 blocks concurrently - one will fail
      await Promise.allSettled([
        store.createBlock(fileId, 'Block 1', 'markdown'),
        store.createBlock(fileId, 'Block 2', 'markdown'), // This will fail
        store.createBlock(fileId, 'Block 3', 'markdown'),
      ])

      // Verify final state has only successful blocks
      const finalStore = useAppStore.getState()
      const finalBlocks = finalStore.files.get(fileId)?.blocks

      expect(finalBlocks).toHaveLength(2)
      expect(finalBlocks?.[0].block_id).toBe('block-1')
      expect(finalBlocks?.[1].block_id).toBe('block-3')

      // Verify error notification was added for the failure
      const notifications = finalStore.notifications
      expect(notifications.some((n) => n.type === 'error')).toBe(true)
    })
  })

  describe('State Consistency', () => {
    test('should maintain map consistency during concurrent file operations', async () => {
      const store = useAppStore.getState()
      const mockEditor = createMockEditor()

      let fileIdCounter = 0
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'create_file') {
          fileIdCounter++
          return `file-${fileIdCounter}` // Unique file IDs
        }
        if (cmd === 'list_editors') {
          return [mockEditor]
        }
        if (
          cmd === 'get_all_blocks' ||
          cmd === 'list_grants' ||
          cmd === 'get_all_events'
        ) {
          return []
        }
        return null
      })

      // Mock dialog
      const { save } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(save)
        .mockResolvedValueOnce('/test/file1.elf')
        .mockResolvedValueOnce('/test/file2.elf')
        .mockResolvedValueOnce('/test/file3.elf')

      // Create multiple files concurrently
      await Promise.all([
        store.createFile(),
        store.createFile(),
        store.createFile(),
      ])

      // Each file should have unique ID, so 3 files should exist
      const finalStore = useAppStore.getState()
      expect(finalStore.files.size).toBe(3)
      expect(finalStore.files.has('file-1')).toBe(true)
      expect(finalStore.files.has('file-2')).toBe(true)
      expect(finalStore.files.has('file-3')).toBe(true)
    })
  })
})
