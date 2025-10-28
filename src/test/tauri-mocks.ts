/**
 * Tauri Mock Utilities
 * 
 * Provides reusable mock functions and test data for Tauri IPC testing
 */

import { mockIPC } from '@tauri-apps/api/mocks'
import type { Block, Editor, Event, Command } from '@/bindings'
import { createMockBlock, createMockEditor, createMockEvent, TEST_FILE_ID, TEST_BLOCK_ID, TEST_EDITOR_ID } from './setup'

/**
 * Mock successful Tauri command responses
 */
export const mockSuccessfulCommands = () => {
  mockIPC((cmd, args) => {
    switch (cmd) {
      case 'create_file':
        return { status: 'ok', data: TEST_FILE_ID }
      
      case 'open_file':
        return { status: 'ok', data: TEST_FILE_ID }
      
      case 'save_file':
        return { status: 'ok', data: null }
      
      case 'close_file':
        return { status: 'ok', data: null }
      
      case 'list_open_files':
        return { status: 'ok', data: [TEST_FILE_ID] }
      
      case 'execute_command':
        return { status: 'ok', data: [createMockEvent()] }
      
      case 'get_block':
        return { status: 'ok', data: createMockBlock({ block_id: args.blockId }) }
      
      case 'get_all_blocks':
        return { status: 'ok', data: [createMockBlock()] }
      
      case 'create_editor':
        return { status: 'ok', data: createMockEditor({ editor_id: args.editorId || TEST_EDITOR_ID, name: args.name }) }
      
      case 'list_editors':
        return { status: 'ok', data: [createMockEditor()] }
      
      case 'get_editor':
        return { status: 'ok', data: createMockEditor({ editor_id: args.editorId }) }
      
      case 'set_active_editor':
        return { status: 'ok', data: null }
      
      case 'get_active_editor':
        return { status: 'ok', data: TEST_EDITOR_ID }
      
      default:
        return { status: 'error', error: `Unknown command: ${cmd}` }
    }
  })
}

/**
 * Mock error responses for specific commands
 */
export const mockErrorCommands = (errorCommands: string[], errorMessage = 'Test error') => {
  mockIPC((cmd, args) => {
    if (errorCommands.includes(cmd)) {
      return { status: 'error', error: errorMessage }
    }
    
    // Fallback to successful responses for other commands
    return mockSuccessfulCommands()
  })
}

/**
 * Mock specific command with custom response
 */
export const mockCommand = (command: string, response: any) => {
  mockIPC((cmd, args) => {
    if (cmd === command) {
      return response
    }
    
    // Fallback to successful responses for other commands
    return mockSuccessfulCommands()
  })
}

/**
 * Mock file operations with specific file IDs
 */
export const mockFileOperations = (fileId: string = TEST_FILE_ID) => {
  mockIPC((cmd, args) => {
    switch (cmd) {
      case 'create_file':
      case 'open_file':
        return { status: 'ok', data: fileId }
      case 'save_file':
      case 'close_file':
        return { status: 'ok', data: null }
      case 'list_open_files':
        return { status: 'ok', data: [fileId] }
      default:
        return mockSuccessfulCommands()
    }
  })
}

/**
 * Mock block operations with specific blocks
 */
export const mockBlockOperations = (blocks: Block[] = [createMockBlock()]) => {
  mockIPC((cmd, args) => {
    switch (cmd) {
      case 'get_all_blocks':
        return { status: 'ok', data: blocks }
      case 'get_block':
        const block = blocks.find(b => b.block_id === args.blockId)
        return block ? { status: 'ok', data: block } : { status: 'error', error: 'Block not found' }
      case 'execute_command':
        return { status: 'ok', data: [createMockEvent()] }
      default:
        return mockSuccessfulCommands()
    }
  })
}

/**
 * Mock editor operations with specific editors
 */
export const mockEditorOperations = (editors: Editor[] = [createMockEditor()], activeEditorId: string | null = TEST_EDITOR_ID) => {
  mockIPC((cmd, args) => {
    switch (cmd) {
      case 'list_editors':
        return { status: 'ok', data: editors }
      case 'get_editor':
        const editor = editors.find(e => e.editor_id === args.editorId)
        return editor ? { status: 'ok', data: editor } : { status: 'error', error: 'Editor not found' }
      case 'create_editor':
        const newEditor = createMockEditor({ editor_id: `editor-${Date.now()}`, name: args.name })
        return { status: 'ok', data: newEditor }
      case 'get_active_editor':
        return { status: 'ok', data: activeEditorId }
      case 'set_active_editor':
        return { status: 'ok', data: null }
      default:
        return mockSuccessfulCommands()
    }
  })
}

/**
 * Verify that a command was called with specific arguments
 */
export const verifyCommandCall = (command: string, expectedArgs: any) => {
  // This would be used with vi.spyOn to verify command calls
  // Implementation depends on specific testing needs
}

/**
 * Test data sets
 */
export const testBlocks: Block[] = [
  createMockBlock({ block_id: 'block-1', name: 'Block 1', block_type: 'markdown' }),
  createMockBlock({ block_id: 'block-2', name: 'Block 2', block_type: 'code' }),
  createMockBlock({ block_id: 'block-3', name: 'Block 3', block_type: 'diagram' }),
]

export const testEditors: Editor[] = [
  createMockEditor({ editor_id: 'editor-1', name: 'Editor 1' }),
  createMockEditor({ editor_id: 'editor-2', name: 'Editor 2' }),
]

export const testEvents: Event[] = [
  createMockEvent({ event_id: 'event-1', entity: 'block-1' }),
  createMockEvent({ event_id: 'event-2', entity: 'block-2' }),
]
