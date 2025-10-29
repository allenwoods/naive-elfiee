/**
 * App Store Editor Operations Tests
 *
 * Tests for editor and grant operations workflow:
 * loadEditors, createEditor, setActiveEditor, loadGrants, grantCapability, revokeCapability, loadEvents
 */

import { describe, expect, test, beforeEach, vi } from 'vitest'
import { useAppStore } from './app-store'
import { setupCommandMocks, setupCommandError } from '@/test/mock-tauri-invoke'
import { createMockEditor, createMockEvent, createMockGrant, TEST_FILE_ID, TEST_EDITOR_ID } from '@/test/setup'
import type { Editor, Event, Grant } from '@/bindings'

describe('AppStore - Editor Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadEditors', () => {
    test('should load editors and active editor successfully', async () => {
      const fileId = TEST_FILE_ID
      const mockEditors: Editor[] = [
        createMockEditor({ editor_id: 'editor-1', name: 'Editor 1' }),
        createMockEditor({ editor_id: 'editor-2', name: 'Editor 2' })
      ]
      const activeEditorId = 'editor-1'

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

      // Mock TauriClient commands
      setupCommandMocks({
        listEditors: mockEditors,
        getActiveEditor: activeEditorId
      })

      await store.loadEditors(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.editors).toEqual(mockEditors)
      expect(updatedStore.files.get(fileId)?.activeEditorId).toBe(activeEditorId)
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
      setupCommandError('listEditors', 'Failed to load editors')

      await store.loadEditors(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: Failed to load editors')
    })
  })

  describe('createEditor', () => {
    test('should create editor successfully', async () => {
      const fileId = TEST_FILE_ID
      const editorName = 'New Editor'
      const mockEditor: Editor = createMockEditor({ name: editorName })

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

      // Mock TauriClient command
      setupCommandMocks({
        createEditor: mockEditor,
        listEditors: [mockEditor]
      })

      await store.createEditor(fileId, editorName)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.editors).toContain(mockEditor)
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle backend error', async () => {
      const fileId = TEST_FILE_ID
      const editorName = 'New Editor'

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
      setupCommandError('createEditor', 'Failed to create editor')

      await store.createEditor(fileId, editorName)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: Failed to create editor')
    })
  })

  describe('setActiveEditor', () => {
    test('should set active editor successfully', async () => {
      const fileId = TEST_FILE_ID
      const editorId = TEST_EDITOR_ID

      // Set up initial state
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [createMockEditor({ editor_id: editorId })],
        activeEditorId: null,
        grants: [],
        events: []
      })

      // Mock TauriClient command
      setupCommandMocks({
        setActiveEditor: null
      })

      await store.setActiveEditor(fileId, editorId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.activeEditorId).toBe(editorId)
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle backend error', async () => {
      const fileId = TEST_FILE_ID
      const editorId = TEST_EDITOR_ID

      // Set up initial state
      const store = useAppStore.getState()
      store.files.set(fileId, {
        fileId,
        blocks: [],
        selectedBlockId: null,
        editors: [createMockEditor({ editor_id: editorId })],
        activeEditorId: null,
        grants: [],
        events: []
      })

      // Mock backend error
      setupCommandError('setActiveEditor', 'Failed to set active editor')

      await store.setActiveEditor(fileId, editorId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: Failed to set active editor')
    })
  })

  describe('loadGrants', () => {
    test('should load grants successfully', async () => {
      const fileId = TEST_FILE_ID
      const mockGrants: Grant[] = [
        createMockGrant({ 
          editor_id: 'editor-1', 
          capability: 'markdown.write', 
          block_id: 'block-1' 
        }),
        createMockGrant({ 
          editor_id: 'editor-2', 
          capability: 'core.read', 
          block_id: '*' 
        })
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

      // Mock TauriClient command
      setupCommandMocks({
        listGrants: mockGrants
      })

      await store.loadGrants(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.grants).toEqual(mockGrants)
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
      setupCommandError('listGrants', 'Failed to load grants')

      await store.loadGrants(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: Failed to load grants')
    })
  })

  describe('grantCapability', () => {
    test('should grant capability successfully', async () => {
      const fileId = TEST_FILE_ID
      const targetEditor = 'target-editor'
      const capability = 'markdown.write'
      const targetBlock = 'block-1'
      const editorId = TEST_EDITOR_ID
      const mockEvents: Event[] = [createMockEvent({ 
        entity: targetBlock, 
        attribute: `${editorId}/core.grant` 
      })]

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

      // Mock TauriClient commands
      setupCommandMocks({
        executeCommand: mockEvents,
        listGrants: [createMockGrant({ 
          editor_id: targetEditor, 
          capability, 
          block_id: targetBlock 
        })]
      })

      await store.grantCapability(fileId, targetEditor, capability, targetBlock)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.grants).toHaveLength(1)
      expect(updatedStore.files.get(fileId)?.grants[0].editor_id).toBe(targetEditor)
      expect(updatedStore.files.get(fileId)?.grants[0].capability).toBe(capability)
      expect(updatedStore.files.get(fileId)?.grants[0].block_id).toBe(targetBlock)
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle missing active editor', async () => {
      const fileId = TEST_FILE_ID
      const targetEditor = 'target-editor'
      const capability = 'markdown.write'

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

      await store.grantCapability(fileId, targetEditor, capability)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: No active editor found. Please select an editor first.')
    })
  })

  describe('revokeCapability', () => {
    test('should revoke capability successfully', async () => {
      const fileId = TEST_FILE_ID
      const targetEditor = 'target-editor'
      const capability = 'markdown.write'
      const targetBlock = 'block-1'
      const editorId = TEST_EDITOR_ID
      const mockEvents: Event[] = [createMockEvent({ 
        entity: targetBlock, 
        attribute: `${editorId}/core.revoke` 
      })]

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

      // Mock TauriClient commands
      setupCommandMocks({
        executeCommand: mockEvents,
        listGrants: [] // Grant revoked, no grants remaining
      })

      await store.revokeCapability(fileId, targetEditor, capability, targetBlock)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.grants).toHaveLength(0)
      expect(updatedStore.isLoading).toBe(false)
      expect(updatedStore.error).toBeNull()
    })

    test('should handle missing active editor', async () => {
      const fileId = TEST_FILE_ID
      const targetEditor = 'target-editor'
      const capability = 'markdown.write'

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

      await store.revokeCapability(fileId, targetEditor, capability)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: No active editor found. Please select an editor first.')
    })
  })

  describe('loadEvents', () => {
    test('should load events successfully', async () => {
      const fileId = TEST_FILE_ID
      const mockEvents: Event[] = [
        createMockEvent({ 
          event_id: 'event-1', 
          entity: 'block-1', 
          attribute: 'editor-1/core.create' 
        }),
        createMockEvent({ 
          event_id: 'event-2', 
          entity: 'block-1', 
          attribute: 'editor-1/markdown.write' 
        })
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

      // Mock TauriClient command
      setupCommandMocks({
        getAllEvents: mockEvents
      })

      await store.loadEvents(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.files.get(fileId)?.events).toEqual(mockEvents)
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
      setupCommandError('getAllEvents', 'Failed to load events')

      await store.loadEvents(fileId)

      const updatedStore = useAppStore.getState()
      expect(updatedStore.notifications).toHaveLength(1)
      expect(updatedStore.notifications[0].type).toBe('error')
      expect(updatedStore.notifications[0].message).toBe('Error: Failed to load events')
    })
  })
})
