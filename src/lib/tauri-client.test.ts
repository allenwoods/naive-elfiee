/**
 * Tauri Client Tests
 *
 * Tests for the Tauri client wrapper functions using type-safe mock system
 */

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { TauriClient } from './tauri-client'
import {
  mockInvoke,
  setupCommandMock,
  setupCommandError,
} from '@/test/mock-tauri-invoke'
import {
  createMockBlock,
  createMockEditor,
  createMockEvent,
  TEST_FILE_ID,
  TEST_BLOCK_ID,
  TEST_EDITOR_ID,
} from '@/test/setup'

describe('TauriClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('FileOperations', () => {
    test('createFile should return file ID on success', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(save).mockResolvedValue('/test/path.elf')
      setupCommandMock('createFile', TEST_FILE_ID)

      const result = await TauriClient.file.createFile()

      expect(result).toBe(TEST_FILE_ID)
      expect(mockInvoke).toHaveBeenCalledWith('create_file', {
        path: '/test/path.elf',
      })
    })

    test('createFile should return null when user cancels', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(save).mockResolvedValue(null)

      const result = await TauriClient.file.createFile()

      expect(result).toBeNull()
    })

    test('createFile should throw on error', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(save).mockResolvedValue('/test/path.elf')
      setupCommandError('createFile', 'Failed to create file')

      await expect(TauriClient.file.createFile()).rejects.toThrow(
        'Failed to create file'
      )
    })

    test('openFile should return file ID on success', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(open).mockResolvedValue('/test/path.elf')
      setupCommandMock('openFile', TEST_FILE_ID)

      const result = await TauriClient.file.openFile()

      expect(result).toBe(TEST_FILE_ID)
      expect(mockInvoke).toHaveBeenCalledWith('open_file', {
        path: '/test/path.elf',
      })
    })

    test('openFile should return null when user cancels', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(open).mockResolvedValue(null)

      const result = await TauriClient.file.openFile()

      expect(result).toBeNull()
    })

    test('openFile should throw on error', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog')
      vi.mocked(open).mockResolvedValue('/test/path.elf')
      setupCommandError('openFile', 'Failed to open file')

      await expect(TauriClient.file.openFile()).rejects.toThrow(
        'Failed to open file'
      )
    })

    test('saveFile should complete successfully', async () => {
      setupCommandMock('saveFile', null)

      await expect(
        TauriClient.file.saveFile(TEST_FILE_ID)
      ).resolves.toBeUndefined()
    })

    test('saveFile should throw on error', async () => {
      setupCommandError('saveFile', 'Failed to save file')

      await expect(TauriClient.file.saveFile(TEST_FILE_ID)).rejects.toThrow(
        'Failed to save file'
      )
    })

    test('closeFile should complete successfully', async () => {
      setupCommandMock('closeFile', null)

      await expect(
        TauriClient.file.closeFile(TEST_FILE_ID)
      ).resolves.toBeUndefined()
    })

    test('closeFile should throw on error', async () => {
      setupCommandError('closeFile', 'Failed to close file')

      await expect(TauriClient.file.closeFile(TEST_FILE_ID)).rejects.toThrow(
        'Failed to close file'
      )
    })
  })

  describe('BlockOperations', () => {
    test('executeCommand should return events on success', async () => {
      const mockEvents = [createMockEvent()]
      setupCommandMock('executeCommand', mockEvents)

      const result = await TauriClient.block.executeCommand(TEST_FILE_ID, {
        cmd_id: 'test-cmd',
        editor_id: TEST_EDITOR_ID,
        cap_id: 'core.create',
        block_id: TEST_BLOCK_ID,
        payload: { name: 'Test Block' },
        timestamp: new Date().toISOString(),
      })

      expect(result).toEqual(mockEvents)
    })

    test('executeCommand should throw on error', async () => {
      setupCommandError('executeCommand', 'Command execution failed')

      await expect(
        TauriClient.block.executeCommand(TEST_FILE_ID, {
          cmd_id: 'test-cmd',
          editor_id: TEST_EDITOR_ID,
          cap_id: 'core.create',
          block_id: TEST_BLOCK_ID,
          payload: { name: 'Test Block' },
          timestamp: new Date().toISOString(),
        })
      ).rejects.toThrow('Command execution failed')
    })

    test('getBlock should return block on success', async () => {
      const mockBlock = createMockBlock({ block_id: TEST_BLOCK_ID })
      setupCommandMock('getBlock', mockBlock)

      const result = await TauriClient.block.getBlock(
        TEST_FILE_ID,
        TEST_BLOCK_ID
      )

      expect(result).toEqual(mockBlock)
    })

    test('getBlock should throw on error', async () => {
      setupCommandError('getBlock', 'Block not found')

      await expect(
        TauriClient.block.getBlock(TEST_FILE_ID, TEST_BLOCK_ID)
      ).rejects.toThrow('Block not found')
    })

    test('getAllBlocks should return blocks array on success', async () => {
      const mockBlocks = [
        createMockBlock(),
        createMockBlock({ block_id: 'block-2' }),
      ]
      setupCommandMock('getAllBlocks', mockBlocks)

      const result = await TauriClient.block.getAllBlocks(TEST_FILE_ID)

      expect(result).toEqual(mockBlocks)
    })

    test('getAllBlocks should throw on error', async () => {
      setupCommandError('getAllBlocks', 'Failed to load blocks')

      await expect(
        TauriClient.block.getAllBlocks(TEST_FILE_ID)
      ).rejects.toThrow('Failed to load blocks')
    })

    test('createBlock should execute command with correct payload', async () => {
      const mockEvents = [createMockEvent()]
      const executeCommandSpy = vi.spyOn(TauriClient.block, 'executeCommand')
      executeCommandSpy.mockResolvedValue(mockEvents)

      await TauriClient.block.createBlock(
        TEST_FILE_ID,
        TEST_BLOCK_ID,
        'Test Block',
        'markdown',
        TEST_EDITOR_ID
      )

      expect(executeCommandSpy).toHaveBeenCalledWith(
        TEST_FILE_ID,
        expect.objectContaining({
          editor_id: TEST_EDITOR_ID,
          cap_id: 'core.create',
          block_id: TEST_BLOCK_ID,
          payload: expect.objectContaining({
            name: 'Test Block',
            block_type: 'markdown',
          }),
        })
      )
    })

    test('writeBlock should execute command with correct payload', async () => {
      const mockEvents = [createMockEvent()]
      const executeCommandSpy = vi.spyOn(TauriClient.block, 'executeCommand')
      executeCommandSpy.mockResolvedValue(mockEvents)

      const content = 'Test content'
      await TauriClient.block.writeBlock(
        TEST_FILE_ID,
        TEST_BLOCK_ID,
        content,
        TEST_EDITOR_ID
      )

      expect(executeCommandSpy).toHaveBeenCalledWith(
        TEST_FILE_ID,
        expect.objectContaining({
          editor_id: TEST_EDITOR_ID,
          cap_id: 'markdown.write',
          block_id: TEST_BLOCK_ID,
          payload: { content },
        })
      )
    })

    test('deleteBlock should execute command with correct payload', async () => {
      const mockEvents = [createMockEvent()]
      const executeCommandSpy = vi.spyOn(TauriClient.block, 'executeCommand')
      executeCommandSpy.mockResolvedValue(mockEvents)

      await TauriClient.block.deleteBlock(
        TEST_FILE_ID,
        TEST_BLOCK_ID,
        TEST_EDITOR_ID
      )

      expect(executeCommandSpy).toHaveBeenCalledWith(
        TEST_FILE_ID,
        expect.objectContaining({
          editor_id: TEST_EDITOR_ID,
          cap_id: 'core.delete',
          block_id: TEST_BLOCK_ID,
          payload: {},
        })
      )
    })

    test('linkBlocks should execute command with correct payload', async () => {
      const mockEvents = [createMockEvent()]
      const executeCommandSpy = vi.spyOn(TauriClient.block, 'executeCommand')
      executeCommandSpy.mockResolvedValue(mockEvents)

      await TauriClient.block.linkBlocks(
        TEST_FILE_ID,
        TEST_BLOCK_ID,
        'target-block',
        'references',
        TEST_EDITOR_ID
      )

      expect(executeCommandSpy).toHaveBeenCalledWith(
        TEST_FILE_ID,
        expect.objectContaining({
          editor_id: TEST_EDITOR_ID,
          cap_id: 'core.link',
          block_id: TEST_BLOCK_ID,
          payload: { relation: 'references', target_id: 'target-block' },
        })
      )
    })

    test('unlinkBlocks should execute command with correct payload', async () => {
      const mockEvents = [createMockEvent()]
      const executeCommandSpy = vi.spyOn(TauriClient.block, 'executeCommand')
      executeCommandSpy.mockResolvedValue(mockEvents)

      await TauriClient.block.unlinkBlocks(
        TEST_FILE_ID,
        TEST_BLOCK_ID,
        'target-block',
        'references',
        TEST_EDITOR_ID
      )

      expect(executeCommandSpy).toHaveBeenCalledWith(
        TEST_FILE_ID,
        expect.objectContaining({
          editor_id: TEST_EDITOR_ID,
          cap_id: 'core.unlink',
          block_id: TEST_BLOCK_ID,
          payload: { relation: 'references', target_id: 'target-block' },
        })
      )
    })
  })

  describe('EditorOperations', () => {
    test('createEditor should return editor on success', async () => {
      const mockEditor = createMockEditor({
        editor_id: 'new-editor',
        name: 'New Editor',
      })
      setupCommandMock('createEditor', mockEditor)

      const result = await TauriClient.editor.createEditor(
        TEST_FILE_ID,
        'New Editor'
      )

      expect(result).toEqual(mockEditor)
      expect(mockInvoke).toHaveBeenCalledWith('create_editor', {
        fileId: TEST_FILE_ID,
        name: 'New Editor',
      })
    })

    test('createEditor should throw on error', async () => {
      setupCommandError('createEditor', 'Failed to create editor')

      await expect(
        TauriClient.editor.createEditor(TEST_FILE_ID, 'New Editor')
      ).rejects.toThrow('Failed to create editor')
    })

    test('listEditors should return editors array on success', async () => {
      const mockEditors = [
        createMockEditor(),
        createMockEditor({ editor_id: 'editor-2' }),
      ]
      setupCommandMock('listEditors', mockEditors)

      const result = await TauriClient.editor.listEditors(TEST_FILE_ID)

      expect(result).toEqual(mockEditors)
    })

    test('listEditors should throw on error', async () => {
      setupCommandError('listEditors', 'Failed to load editors')

      await expect(
        TauriClient.editor.listEditors(TEST_FILE_ID)
      ).rejects.toThrow('Failed to load editors')
    })

    test('getEditor should return editor on success', async () => {
      const mockEditor = createMockEditor({ editor_id: TEST_EDITOR_ID })
      setupCommandMock('getEditor', mockEditor)

      const result = await TauriClient.editor.getEditor(
        TEST_FILE_ID,
        TEST_EDITOR_ID
      )

      expect(result).toEqual(mockEditor)
    })

    test('getEditor should throw on error', async () => {
      setupCommandError('getEditor', 'Editor not found')

      await expect(
        TauriClient.editor.getEditor(TEST_FILE_ID, TEST_EDITOR_ID)
      ).rejects.toThrow('Editor not found')
    })

    test('setActiveEditor should complete successfully', async () => {
      setupCommandMock('setActiveEditor', null)

      await expect(
        TauriClient.editor.setActiveEditor(TEST_FILE_ID, TEST_EDITOR_ID)
      ).resolves.toBeUndefined()
    })

    test('setActiveEditor should throw on error', async () => {
      setupCommandError('setActiveEditor', 'Failed to set active editor')

      await expect(
        TauriClient.editor.setActiveEditor(TEST_FILE_ID, TEST_EDITOR_ID)
      ).rejects.toThrow('Failed to set active editor')
    })

    test('getActiveEditor should return editor ID on success', async () => {
      setupCommandMock('getActiveEditor', TEST_EDITOR_ID)

      const result = await TauriClient.editor.getActiveEditor(TEST_FILE_ID)

      expect(result).toBe(TEST_EDITOR_ID)
    })

    test('getActiveEditor should return null when no active editor', async () => {
      setupCommandMock('getActiveEditor', null)

      const result = await TauriClient.editor.getActiveEditor(TEST_FILE_ID)

      expect(result).toBeNull()
    })

    test('getActiveEditor should throw on error', async () => {
      setupCommandError('getActiveEditor', 'Failed to get active editor')

      await expect(
        TauriClient.editor.getActiveEditor(TEST_FILE_ID)
      ).rejects.toThrow('Failed to get active editor')
    })
  })
})
