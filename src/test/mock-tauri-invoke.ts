/**
 * Type-safe Tauri IPC Mock Utilities
 *
 * This module provides type-safe mocking for Tauri commands by mocking the
 * invoke function from @tauri-apps/api/core. All types are automatically
 * synced with the backend through tauri-specta generated bindings.
 */

import { vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import type { Block, Editor, Event, Grant } from '@/bindings'

// Get the mocked invoke function (mocked in setup.ts)
export const mockInvoke = vi.mocked(invoke)

/**
 * Type-safe response builders for each command
 * These functions ensure the mock responses match the expected types from bindings.ts
 */
export const MockResponses = {
  // File operations
  createFile: (fileId: string) => fileId,
  openFile: (fileId: string) => fileId,
  saveFile: () => null,
  closeFile: () => null,
  listOpenFiles: (fileIds: string[]) => fileIds,
  getAllEvents: (events: Event[]) => events,

  // Block operations
  getAllBlocks: (blocks: Block[]) => blocks,
  getBlock: (block: Block) => block,
  executeCommand: (events: Event[]) => events,

  // Editor operations
  createEditor: (editor: Editor) => editor,
  listEditors: (editors: Editor[]) => editors,
  getEditor: (editor: Editor) => editor,
  setActiveEditor: () => null,
  getActiveEditor: (editorId: string | null) => editorId,

  // Grant operations
  listGrants: (grants: Grant[]) => grants,
  getEditorGrants: (grants: Grant[]) => grants,
  getBlockGrants: (grants: Grant[]) => grants,
}

/**
 * Convert camelCase command name to snake_case for IPC
 * e.g., "createFile" -> "create_file"
 */
function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/**
 * Setup a mock response for a specific command
 *
 * @param commandName - The command name in camelCase (matching bindings.ts)
 * @param response - The response data (will be automatically resolved in a Promise)
 * @param options - Configuration options (e.g., throwOnUnmocked to catch missing mocks)
 *
 * @example
 * ```typescript
 * setupCommandMock('createFile', 'file-123')
 * const result = await commands.createFile('/path/to/file')
 * // result = { status: 'ok', data: 'file-123' }
 * ```
 */
export function setupCommandMock<K extends keyof typeof MockResponses>(
  commandName: K,
  response: ReturnType<typeof MockResponses[K]>,
  options?: { throwOnUnmocked?: boolean }
) {
  const snakeCaseCmd = toSnakeCase(commandName)

  mockInvoke.mockImplementation((cmd: string, _args: any) => {
    if (cmd === snakeCaseCmd) {
      return Promise.resolve(response)
    }
    // If throwOnUnmocked is true, throw error for missing mocks (useful for catching bugs)
    // Otherwise return null for backward compatibility
    if (options?.throwOnUnmocked) {
      return Promise.reject(new Error(`Command not mocked: ${cmd}`))
    }
    return Promise.resolve(null)
  })
}

/**
 * Setup multiple command mocks at once
 *
 * @param mocks - Map of command names to responses
 * @param options - Configuration options (e.g., throwOnUnmocked to catch missing mocks)
 *
 * @example
 * ```typescript
 * setupCommandMocks({
 *   createFile: 'file-123',
 *   getAllBlocks: [block1, block2],
 *   listEditors: [editor1],
 * })
 *
 * // With strict mode to catch unmocked commands
 * setupCommandMocks({
 *   createFile: 'file-123',
 * }, { throwOnUnmocked: true })
 * ```
 */
export function setupCommandMocks(
  mocks: Partial<{
    [K in keyof typeof MockResponses]: ReturnType<typeof MockResponses[K]>
  }>,
  options?: { throwOnUnmocked?: boolean }
) {
  const mockMap = new Map<string, any>()

  for (const [key, value] of Object.entries(mocks)) {
    const snakeCaseCmd = toSnakeCase(key)
    mockMap.set(snakeCaseCmd, value)
  }

  mockInvoke.mockImplementation((cmd: string, _args: any) => {
    if (mockMap.has(cmd)) {
      return Promise.resolve(mockMap.get(cmd))
    }
    // If throwOnUnmocked is true, throw error for missing mocks
    // Otherwise return null for backward compatibility
    if (options?.throwOnUnmocked) {
      return Promise.reject(new Error(`Command not mocked: ${cmd}`))
    }
    return Promise.resolve(null)
  })
}

/**
 * Setup a command to throw an error
 *
 * @example
 * ```typescript
 * setupCommandError('createFile', 'Failed to create file')
 * await commands.createFile('/path') // throws Error('Failed to create file')
 * ```
 */
export function setupCommandError(
  commandName: keyof typeof MockResponses,
  errorMessage: string
) {
  const snakeCaseCmd = toSnakeCase(commandName)

  mockInvoke.mockImplementation((cmd: string, _args: any) => {
    if (cmd === snakeCaseCmd) {
      return Promise.reject(new Error(errorMessage))
    }
    return Promise.resolve(null)
  })
}

