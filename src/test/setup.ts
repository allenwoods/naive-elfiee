import { vi } from 'vitest'
import { beforeEach } from 'vitest'
import type { Block, Editor, Event, Grant } from '@/bindings'

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock @tauri-apps/plugin-dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

// Test constants
export const TEST_FILE_ID = 'test-file-1'
export const TEST_BLOCK_ID = 'test-block-1'
export const TEST_EDITOR_ID = 'test-editor-1'

// Mock data helpers
export function createMockBlock(overrides?: Partial<Block>): Block {
  return {
    block_id: overrides?.block_id || TEST_BLOCK_ID,
    file_id: overrides?.file_id || TEST_FILE_ID,
    name: overrides?.name || 'Test Block',
    block_type: overrides?.block_type || 'markdown',
    owner: overrides?.owner || 'user-1',
    contents: overrides?.contents || {
      markdown: '# Test Content',
      metadata: {},
    },
    created_at: overrides?.created_at || {
      secs_since_epoch: Date.now() / 1000,
    },
    updated_at: overrides?.updated_at || {
      secs_since_epoch: Date.now() / 1000,
    },
  }
}

export function createMockEditor(overrides?: Partial<Editor>): Editor {
  return {
    editor_id: overrides?.editor_id || TEST_EDITOR_ID,
    file_id: overrides?.file_id || TEST_FILE_ID,
    name: overrides?.name || 'Test Editor',
    created_at: overrides?.created_at || {
      secs_since_epoch: Date.now() / 1000,
    },
  }
}

export function createMockEvent(overrides?: Partial<Event>): Event {
  return {
    event_id: overrides?.event_id || 'test-event-1',
    file_id: overrides?.file_id || TEST_FILE_ID,
    block_id: overrides?.block_id || TEST_BLOCK_ID,
    event_type: overrides?.event_type || 'block_created',
    payload: overrides?.payload || {},
    timestamp: overrides?.timestamp || { secs_since_epoch: Date.now() / 1000 },
  }
}

export function createMockGrant(overrides?: Partial<Grant>): Grant {
  return {
    grant_id: overrides?.grant_id || 'test-grant-1',
    file_id: overrides?.file_id || TEST_FILE_ID,
    block_id: overrides?.block_id || TEST_BLOCK_ID,
    editor_id: overrides?.editor_id || TEST_EDITOR_ID,
    capability: overrides?.capability || 'read',
    created_at: overrides?.created_at || {
      secs_since_epoch: Date.now() / 1000,
    },
  }
}

// Setup before each test
beforeEach(() => {
  vi.clearAllMocks()
})
