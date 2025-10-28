import { afterEach, beforeEach } from 'vitest'
import { clearMocks } from '@tauri-apps/api/mocks'
import { randomFillSync } from 'crypto'
import '@testing-library/jest-dom'
import { useAppStore } from '@/lib/app-store'
import type { Block, Editor, Event } from '@/bindings'

// jsdom doesn't come with a WebCrypto implementation
// Configure WebCrypto polyfill for Tauri mocking
Object.defineProperty(window, 'crypto', {
  value: {
    // @ts-ignore
    getRandomValues: (buffer) => {
      return randomFillSync(buffer)
    },
  },
})

// Clear all mocks after each test to prevent state leakage
afterEach(() => {
  clearMocks()
})

// Reset Zustand store before each test
beforeEach(() => {
  useAppStore.setState({
    files: new Map(),
    activeFileId: null,
    isLoading: false,
    error: null,
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
