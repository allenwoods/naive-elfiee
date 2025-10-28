import { afterEach, beforeEach, vi } from 'vitest'
import { clearMocks } from '@tauri-apps/api/mocks'
import { randomFillSync } from 'crypto'
import '@testing-library/jest-dom'
import { useAppStore } from '@/lib/app-store'
import type { Block, Editor, Event } from '@/bindings'

// Create mock invoke function using vi.hoisted to allow use in vi.mock
// Note: We don't export this - instead, import 'invoke' from '@tauri-apps/api/core' in tests
const mockInvoke = vi.hoisted(() => vi.fn())

// Mock @tauri-apps/api/core to intercept all invoke calls
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

// Import the mocked invoke for use in beforeEach
import { invoke } from '@tauri-apps/api/core'

// Mock @tauri-apps/plugin-dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
  message: vi.fn(),
}))

// jsdom doesn't come with a WebCrypto implementation
// Configure WebCrypto polyfill for Tauri mocking
Object.defineProperty(window, 'crypto', {
  value: {
    // @ts-ignore
    getRandomValues: (buffer) => {
      return randomFillSync(buffer)
    },
    // Add randomUUID for command ID generation
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    },
  },
})

// Clear all mocks after each test to prevent state leakage
afterEach(() => {
  clearMocks()
})

// Reset Zustand store before each test
beforeEach(() => {
  // Reset command mocks
  vi.mocked(invoke).mockReset()
  vi.mocked(invoke).mockResolvedValue(null)

  // Reset app store
  useAppStore.setState({
    files: new Map(),
    activeFileId: null,
    isLoading: false,
    error: null,
    notifications: [],
  })
})

// Test data factories
export const createMockBlock = (overrides: Partial<Block> = {}): Block => ({
  block_id: 'test-block-1',
  name: 'Test Block',
  block_type: 'markdown',
  contents: { type: 'text', data: 'Test content' },
  children: {},
  owner: 'test-editor-1',
  ...overrides,
})

export const createMockEditor = (overrides: Partial<Editor> = {}): Editor => ({
  editor_id: 'test-editor-1',
  name: 'Test Editor',
  ...overrides,
})

export const createMockEvent = (overrides: Partial<Event> = {}): Event => ({
  event_id: 'test-event-1',
  entity: 'test-block-1',
  attribute: 'test-editor-1/core.create',
  value: { name: 'Test Block' },
  timestamp: { 'test-editor-1': 1 },
  ...overrides,
})

// Mock file IDs for testing
export const TEST_FILE_ID = 'test-file-1'
export const TEST_BLOCK_ID = 'test-block-1'
export const TEST_EDITOR_ID = 'test-editor-1'
