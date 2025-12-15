/**
 * Tauri Client - Wrapper around auto-generated Tauri bindings
 *
 * This module provides a high-level interface to interact with Tauri backend.
 * It uses auto-generated bindings from tauri-specta for type-safe communication.
 */

import {
  commands,
  type Block,
  type Command,
  type Event,
  type Editor,
  type Grant,
  type JsonValue,
  type CreateBlockPayload,
  type LinkBlockPayload,
  type UnlinkBlockPayload,
  type GrantPayload,
  type RevokePayload,
  type MarkdownWritePayload,
} from '@/bindings'

/**
 * Default editor ID for single-user MVP
 */
const DEFAULT_EDITOR_ID = 'default-editor'

/**
 * Helper to create a command
 */
function createCommand(
  editorId: string,
  capId: string,
  blockId: string,
  payload: JsonValue
): Command {
  return {
    cmd_id: crypto.randomUUID(),
    editor_id: editorId,
    cap_id: capId,
    block_id: blockId,
    payload,
    timestamp: new Date().toISOString(),
  }
}

/**
 * File Operations
 */
export class FileOperations {
  static async createFile(path: string): Promise<string> {
    const result = await commands.createFile(path)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async openFile(path: string): Promise<string> {
    const result = await commands.openFile(path)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async saveFile(fileId: string): Promise<void> {
    const result = await commands.saveFile(fileId)
    if (result.status === 'ok') {
      return
    } else {
      throw new Error(result.error)
    }
  }

  static async closeFile(fileId: string): Promise<void> {
    const result = await commands.closeFile(fileId)
    if (result.status === 'ok') {
      return
    } else {
      throw new Error(result.error)
    }
  }

  static async listOpenFiles(): Promise<string[]> {
    const result = await commands.listOpenFiles()
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async getAllEvents(fileId: string): Promise<Event[]> {
    const result = await commands.getAllEvents(fileId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }
}

/**
 * Block Operations
 */
export class BlockOperations {
  static async getBlock(fileId: string, blockId: string): Promise<Block> {
    const result = await commands.getBlock(fileId, blockId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async getAllBlocks(fileId: string): Promise<Block[]> {
    const result = await commands.getAllBlocks(fileId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async executeCommand(
    fileId: string,
    cmd: Command
  ): Promise<Event[]> {
    const result = await commands.executeCommand(fileId, cmd)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async createBlock(
    fileId: string,
    name: string,
    blockType: string,
    editorId: string = DEFAULT_EDITOR_ID
  ): Promise<Event[]> {
    const payload: CreateBlockPayload = {
      name,
      block_type: blockType,
    }
    const cmd = createCommand(
      editorId,
      'core.create',
      '*',
      payload as unknown as JsonValue
    )
    return await this.executeCommand(fileId, cmd)
  }

  static async writeBlock(
    fileId: string,
    blockId: string,
    content: string,
    editorId: string = DEFAULT_EDITOR_ID
  ): Promise<Event[]> {
    const payload: MarkdownWritePayload = {
      content,
    }
    const cmd = createCommand(
      editorId,
      'markdown.write',
      blockId,
      payload as unknown as JsonValue
    )
    return await this.executeCommand(fileId, cmd)
  }

  static async deleteBlock(
    fileId: string,
    blockId: string,
    editorId: string = DEFAULT_EDITOR_ID
  ): Promise<Event[]> {
    const cmd = createCommand(editorId, 'core.delete', blockId, {} as JsonValue)
    return await this.executeCommand(fileId, cmd)
  }
}

/**
 * Editor Operations
 */
export class EditorOperations {
  static async createEditor(
    fileId: string,
    name: string
  ): Promise<Editor> {
    const result = await commands.createEditor(fileId, name)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async listEditors(fileId: string): Promise<Editor[]> {
    const result = await commands.listEditors(fileId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async getEditor(
    fileId: string,
    editorId: string
  ): Promise<Editor> {
    const result = await commands.getEditor(fileId, editorId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async setActiveEditor(
    fileId: string,
    editorId: string
  ): Promise<void> {
    const result = await commands.setActiveEditor(fileId, editorId)
    if (result.status === 'ok') {
      return
    } else {
      throw new Error(result.error)
    }
  }

  static async getActiveEditor(fileId: string): Promise<string | null> {
    const result = await commands.getActiveEditor(fileId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async listGrants(fileId: string): Promise<Grant[]> {
    const result = await commands.listGrants(fileId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async getEditorGrants(
    fileId: string,
    editorId: string
  ): Promise<Grant[]> {
    const result = await commands.getEditorGrants(fileId, editorId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async getBlockGrants(
    fileId: string,
    blockId: string
  ): Promise<Grant[]> {
    const result = await commands.getBlockGrants(fileId, blockId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async grantCapability(
    fileId: string,
    targetEditor: string,
    capability: string,
    targetBlock: string = '*',
    editorId: string = DEFAULT_EDITOR_ID
  ): Promise<Event[]> {
    const payload: GrantPayload = {
      target_editor: targetEditor,
      capability,
      target_block: targetBlock,
    }
    const cmd = createCommand(
      editorId,
      'core.grant',
      targetBlock,
      payload as unknown as JsonValue
    )
    return await BlockOperations.executeCommand(fileId, cmd)
  }

  static async revokeCapability(
    fileId: string,
    targetEditor: string,
    capability: string,
    targetBlock: string = '*',
    editorId: string = DEFAULT_EDITOR_ID
  ): Promise<Event[]> {
    const payload: RevokePayload = {
      target_editor: targetEditor,
      capability,
      target_block: targetBlock,
    }
    const cmd = createCommand(
      editorId,
      'core.revoke',
      targetBlock,
      payload as unknown as JsonValue
    )
    return await BlockOperations.executeCommand(fileId, cmd)
  }
}

/**
 * Main Tauri Client export
 */
export const TauriClient = {
  file: FileOperations,
  block: BlockOperations,
  editor: EditorOperations,
}

