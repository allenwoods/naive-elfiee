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
  type GrantPayload,
  type RevokePayload,
  type FileMetadata,
} from '@/bindings'
import { sortEventsByVectorClock } from '@/utils/event-utils'

/**
 * Cache for system editor ID
 */
let SYSTEM_EDITOR_ID_CACHE: string | null = null

/**
 * Get the system editor ID (with caching)
 *
 * This fetches the persistent system editor ID from the backend config.
 * The ID is cached after first fetch to avoid repeated IPC calls.
 */
async function getSystemEditorId(): Promise<string> {
  if (SYSTEM_EDITOR_ID_CACHE) {
    return SYSTEM_EDITOR_ID_CACHE
  }

  try {
    const result = await commands.getSystemEditorIdFromConfig()
    if (result.status === 'ok') {
      SYSTEM_EDITOR_ID_CACHE = result.data
      return result.data
    } else {
      console.error('Failed to get system editor ID:', result.error)
      return 'system' // Ultimate fallback
    }
  } catch (error) {
    console.error('Error getting system editor ID:', error)
    return 'system' // Ultimate fallback
  }
}

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

  static async listOpenFiles(): Promise<string[]> {
    const result = await commands.listOpenFiles()
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Save the current state of a file to disk.
   *
   * This persists all changes made since the file was opened or last saved.
   *
   * @param fileId - Unique identifier of the file to save
   */
  static async saveFile(fileId: string): Promise<void> {
    const result = await commands.saveFile(fileId)
    if (result.status === 'ok') {
      return
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Get detailed information about a file.
   *
   * @param fileId - Unique identifier of the file
   * @returns File metadata (name, path, collaborators, timestamps)
   */
  static async getFileInfo(fileId: string): Promise<FileMetadata> {
    const result = await commands.getFileInfo(fileId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Rename a file.
   *
   * @param fileId - Unique identifier of the file
   * @param newName - New name for the file (without .elf extension)
   */
  static async renameFile(fileId: string, newName: string): Promise<void> {
    const result = await commands.renameFile(fileId, newName)
    if (result.status === 'ok') {
      return
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Close a file and release associated resources.
   *
   * This removes the file from the open files list and shuts down the engine actor.
   * The physical file remains on disk and can be reopened later.
   * Unsaved changes will be lost.
   *
   * @param fileId - Unique identifier of the file to close
   */
  static async closeFile(fileId: string): Promise<void> {
    const result = await commands.closeFile(fileId)
    if (result.status === 'ok') {
      return
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Duplicate (copy) an existing .elf file.
   *
   * This creates a copy of the file with a new name and opens it for editing.
   * The new file will have " Copy" appended to the name.
   *
   * @param fileId - Unique identifier of the file to duplicate
   * @returns The file ID of the newly created duplicate
   */
  static async duplicateFile(fileId: string): Promise<string> {
    const result = await commands.duplicateFile(fileId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async getSystemEditorId(): Promise<string> {
    const result = await commands.getSystemEditorIdFromConfig()
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
  static async getAllBlocks(
    fileId: string,
    editorId?: string
  ): Promise<Block[]> {
    const result = await commands.getAllBlocks(fileId, editorId || null)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async executeCommand(fileId: string, cmd: Command): Promise<Event[]> {
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
    editorId?: string,
    source?: string
  ): Promise<Event[]> {
    // Get active editor if not provided
    const activeEditorId =
      editorId ||
      (await EditorOperations.getActiveEditor(fileId)) ||
      (await getSystemEditorId())

    const payload: CreateBlockPayload = {
      name,
      block_type: blockType,
      source: source || 'outline',
    }
    const cmd = createCommand(
      activeEditorId,
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
    blockType: string = 'markdown',
    editorId?: string
  ): Promise<Event[]> {
    // Get active editor if not provided
    const activeEditorId =
      editorId ||
      (await EditorOperations.getActiveEditor(fileId)) ||
      (await getSystemEditorId())

    const capId = blockType === 'code' ? 'code.write' : 'markdown.write'

    // Both payloads have a 'content' field
    const payload = { content }

    const cmd = createCommand(
      activeEditorId,
      capId,
      blockId,
      payload as unknown as JsonValue
    )
    return await this.executeCommand(fileId, cmd)
  }

  static async deleteBlock(
    fileId: string,
    blockId: string,
    editorId?: string
  ): Promise<Event[]> {
    // Get active editor if not provided
    const activeEditorId =
      editorId ||
      (await EditorOperations.getActiveEditor(fileId)) ||
      (await getSystemEditorId())

    const cmd = createCommand(
      activeEditorId,
      'core.delete',
      blockId,
      {} as JsonValue
    )
    return await this.executeCommand(fileId, cmd)
  }

  static async updateBlockMetadata(
    fileId: string,
    blockId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const result = await commands.updateBlockMetadata(
      fileId,
      blockId,
      metadata as JsonValue
    )
    if (result.status === 'ok') {
      return
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Rename a block.
   */
  static async renameBlock(
    fileId: string,
    blockId: string,
    name: string
  ): Promise<Event[]> {
    const result = await commands.renameBlock(fileId, blockId, name)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Check if current editor has permission for a capability.
   */
  static async checkPermission(
    fileId: string,
    blockId: string,
    capability: string,
    editorId?: string
  ): Promise<boolean> {
    const result = await commands.checkPermission(
      fileId,
      blockId,
      capability,
      editorId || null
    )
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }
}

/**
 * Directory Extension Operations
 */
export class DirectoryOperations {
  /**
   * Import external directory into a directory block.
   */
  static async importDirectory(
    fileId: string,
    blockId: string,
    sourcePath: string,
    targetPath?: string,
    editorId?: string
  ): Promise<Event[]> {
    const activeEditorId =
      editorId ||
      (await EditorOperations.getActiveEditor(fileId)) ||
      (await getSystemEditorId())

    const result = await commands.executeCommand(fileId, {
      cmd_id: crypto.randomUUID(),
      editor_id: activeEditorId,
      cap_id: 'directory.import',
      block_id: blockId,
      payload: {
        source_path: sourcePath,
        target_path: targetPath || null,
      } as unknown as JsonValue,
      timestamp: new Date().toISOString(),
    })

    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Create a new entry (file/folder) in a directory block.
   */
  static async createEntry(
    fileId: string,
    blockId: string,
    path: string,
    type: 'file' | 'directory',
    options?: { content?: string; block_type?: string; source?: string },
    editorId?: string
  ): Promise<Event[]> {
    const activeEditorId =
      editorId ||
      (await EditorOperations.getActiveEditor(fileId)) ||
      (await getSystemEditorId())

    const result = await commands.executeCommand(fileId, {
      cmd_id: crypto.randomUUID(),
      editor_id: activeEditorId,
      cap_id: 'directory.create',
      block_id: blockId,
      payload: {
        path,
        type,
        source: options?.source || 'outline',
        content: options?.content || null,
        block_type: options?.block_type || null,
      } as unknown as JsonValue,
      timestamp: new Date().toISOString(),
    })

    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Rename an entry path.
   */
  static async renameEntry(
    fileId: string,
    blockId: string,
    oldPath: string,
    newPath: string,
    editorId?: string
  ): Promise<Event[]> {
    const activeEditorId =
      editorId ||
      (await EditorOperations.getActiveEditor(fileId)) ||
      (await getSystemEditorId())

    const result = await commands.executeCommand(fileId, {
      cmd_id: crypto.randomUUID(),
      editor_id: activeEditorId,
      cap_id: 'directory.rename',
      block_id: blockId,
      payload: {
        old_path: oldPath,
        new_path: newPath,
      } as unknown as JsonValue,
      timestamp: new Date().toISOString(),
    })

    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Delete an entry path.
   */
  static async deleteEntry(
    fileId: string,
    blockId: string,
    path: string,
    editorId?: string
  ): Promise<Event[]> {
    const activeEditorId =
      editorId ||
      (await EditorOperations.getActiveEditor(fileId)) ||
      (await getSystemEditorId())

    const result = await commands.executeCommand(fileId, {
      cmd_id: crypto.randomUUID(),
      editor_id: activeEditorId,
      cap_id: 'directory.delete',
      block_id: blockId,
      payload: {
        path,
      } as unknown as JsonValue,
      timestamp: new Date().toISOString(),
    })

    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * Checkout (Export) workspace to disk.
   */
  static async checkoutWorkspace(
    fileId: string,
    blockId: string,
    targetPath: string,
    sourcePath?: string
  ): Promise<void> {
    const result = await commands.checkoutWorkspace(fileId, blockId, {
      target_path: targetPath,
      source_path: sourcePath || null,
    })
    if (result.status === 'error') {
      throw new Error(result.error)
    }
  }
}

/**
 * Editor Operations
 */
export class EditorOperations {
  static async createEditor(
    fileId: string,
    name: string,
    editorType?: string,
    blockId?: string
  ): Promise<Editor> {
    const result = await commands.createEditor(
      fileId,
      name,
      editorType ?? null,
      blockId ?? null
    )
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  static async deleteEditor(
    fileId: string,
    editorId: string,
    blockId?: string
  ): Promise<void> {
    const result = await commands.deleteEditor(
      fileId,
      editorId,
      blockId ?? null
    )
    if (result.status === 'ok') {
      return
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

  static async getEditor(fileId: string, editorId: string): Promise<Editor> {
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
    const result = await commands.listGrants(fileId, null)
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
    editorId?: string
  ): Promise<Event[]> {
    // Get active editor if not provided
    const activeEditorId =
      editorId ||
      (await this.getActiveEditor(fileId)) ||
      (await getSystemEditorId())

    const payload: GrantPayload = {
      target_editor: targetEditor,
      capability,
      target_block: targetBlock,
    }
    const cmd = createCommand(
      activeEditorId,
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
    editorId?: string
  ): Promise<Event[]> {
    // Get active editor if not provided
    const activeEditorId =
      editorId ||
      (await this.getActiveEditor(fileId)) ||
      (await getSystemEditorId())

    const payload: RevokePayload = {
      target_editor: targetEditor,
      capability,
      target_block: targetBlock,
    }
    const cmd = createCommand(
      activeEditorId,
      'core.revoke',
      targetBlock,
      payload as unknown as JsonValue
    )
    return await BlockOperations.executeCommand(fileId, cmd)
  }
}

/**
 * Event Operations
 */
export class EventOperations {
  /**
   * 获取所有事件
   */
  static async getAllEvents(fileId: string): Promise<Event[]> {
    const result = await commands.getAllEvents(fileId, null)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * 获取指定 Event 时刻的完整状态快照（包含权限）
   */
  static async getStateAtEvent(
    fileId: string,
    blockId: string,
    eventId: string
  ): Promise<{ block: Block; grants: Grant[] }> {
    const result = await commands.getStateAtEvent(fileId, blockId, eventId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * 按向量时钟对事件排序（降序：最新在前）
   * 如果向量时钟无法区分先后（并发），则使用 created_at 作为备选排序依据
   *
   * @deprecated 请直接使用 `import { sortEventsByVectorClock } from '@/utils/event-utils'`
   */
  static sortEventsByVectorClock(events: Event[]): Event[] {
    // 委托给独立的 utils 函数
    return sortEventsByVectorClock(events)
  }

  /**
   * 解析 Event，提取操作信息
   */
  static parseEvent(event: Event): {
    operator: string // 操作人员
    operatorName: string // 操作人员显示名称
    action: string // 操作描述（简洁版本）
  } {
    const [editorId, capId] = event.attribute.split('/')

    return {
      operator: editorId,
      operatorName: editorId === 'system' ? 'System' : editorId,
      action: getActionDescription(capId),
    }
  }
}

/**
 * 获取操作的简洁描述
 */
function getActionDescription(capId: string): string {
  const labels: Record<string, string> = {
    'core.create': '创建了文件',
    'markdown.write': '修改了文件内容',
    'core.delete': '删除了文件',
    'core.grant': '授予了权限',
    'core.revoke': '撤销了权限',
  }
  return labels[capId] || capId
}

/**
 * Main Tauri Client export
 */
export const TauriClient = {
  file: FileOperations,
  block: BlockOperations,
  editor: EditorOperations,
  directory: DirectoryOperations,
  event: EventOperations,
}
