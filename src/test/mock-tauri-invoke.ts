import { vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import type { Command } from '@/bindings'

/**
 * Type-safe mock for Tauri invoke function
 * Automatically handles snake_case/camelCase conversion
 */
export function setupCommandMock<T extends keyof Command>(
  command: T,
  response: Awaited<ReturnType<Command[T]>>
) {
  vi.mocked(invoke).mockImplementation(async (cmd: string, args?: any) => {
    if (cmd === command) {
      return response
    }
    throw new Error(`Unexpected command: ${cmd}`)
  })
}

/**
 * Setup multiple command mocks at once
 */
export function setupCommandMocks(
  mocks: Partial<{
    [K in keyof Command]: Awaited<ReturnType<Command[K]>>
  }>
) {
  vi.mocked(invoke).mockImplementation(async (cmd: string, args?: any) => {
    if (cmd in mocks) {
      return mocks[cmd as keyof typeof mocks]
    }
    throw new Error(`No mock for command: ${cmd}`)
  })
}

/**
 * Setup a command to return an error
 */
export function setupCommandError(command: keyof Command, errorMessage: string) {
  vi.mocked(invoke).mockImplementation(async (cmd: string, args?: any) => {
    if (cmd === command) {
      throw new Error(errorMessage)
    }
    throw new Error(`Unexpected command: ${cmd}`)
  })
}

/**
 * Get the mocked invoke function for assertions
 */
export function getMockedInvoke() {
  return vi.mocked(invoke)
}

