/**
 * Application State Management using Zustand
 *
 * This store manages the application state including:
 * - Currently open files
 * - Active file
 * - Blocks for the active file
 * - UI state
 */

import { create } from 'zustand';
import type { Block } from './types';
import TauriClient from './tauri-client';

interface FileState {
  fileId: string;
  blocks: Block[];
  selectedBlockId: string | null;
}

interface AppStore {
  // State
  files: Map<string, FileState>;
  activeFileId: string | null;
  isLoading: boolean;
  error: string | null;

  // File Actions
  createFile: () => Promise<void>;
  openFile: () => Promise<void>;
  closeFile: (fileId: string) => Promise<void>;
  saveFile: (fileId: string) => Promise<void>;
  setActiveFile: (fileId: string | null) => void;

  // Block Actions
  loadBlocks: (fileId: string) => Promise<void>;
  createBlock: (
    fileId: string,
    parentId: string | null,
    content: { type: 'text' | 'link'; data: string }
  ) => Promise<void>;
  updateBlock: (
    fileId: string,
    blockId: string,
    content: { type: 'text' | 'link'; data: string }
  ) => Promise<void>;
  deleteBlock: (fileId: string, blockId: string) => Promise<void>;
  selectBlock: (fileId: string, blockId: string | null) => void;

  // Getters
  getActiveFile: () => FileState | null;
  getBlocks: (fileId: string) => Block[];
  getSelectedBlock: (fileId: string) => Block | null;

  // UI Actions
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial State
  files: new Map(),
  activeFileId: null,
  isLoading: false,
  error: null,

  // File Actions
  createFile: async () => {
    try {
      set({ isLoading: true, error: null });
      const fileId = await TauriClient.file.createFile();

      if (fileId) {
        const files = new Map(get().files);
        files.set(fileId, {
          fileId,
          blocks: [],
          selectedBlockId: null,
        });
        set({ files, activeFileId: fileId });
        await get().loadBlocks(fileId);
      }
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  openFile: async () => {
    try {
      set({ isLoading: true, error: null });
      const fileId = await TauriClient.file.openFile();

      if (fileId) {
        const files = new Map(get().files);
        files.set(fileId, {
          fileId,
          blocks: [],
          selectedBlockId: null,
        });
        set({ files, activeFileId: fileId });
        await get().loadBlocks(fileId);
      }
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  closeFile: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null });
      await TauriClient.file.closeFile(fileId);

      const files = new Map(get().files);
      files.delete(fileId);

      const newActiveFileId =
        get().activeFileId === fileId
          ? files.size > 0
            ? Array.from(files.keys())[0]
            : null
          : get().activeFileId;

      set({ files, activeFileId: newActiveFileId });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  saveFile: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null });
      await TauriClient.file.saveFile(fileId);
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveFile: (fileId: string | null) => {
    set({ activeFileId: fileId });
  },

  // Block Actions
  loadBlocks: async (fileId: string) => {
    try {
      set({ isLoading: true, error: null });
      const blocks = await TauriClient.block.getAllBlocks(fileId);

      const files = new Map(get().files);
      const fileState = files.get(fileId);
      if (fileState) {
        files.set(fileId, { ...fileState, blocks });
        set({ files });
      }
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  createBlock: async (
    fileId: string,
    parentId: string | null,
    content: { type: 'text' | 'link'; data: string }
  ) => {
    try {
      set({ isLoading: true, error: null });
      const blockId = `block-${crypto.randomUUID()}`;
      await TauriClient.block.createBlock(fileId, blockId, parentId, content);
      await get().loadBlocks(fileId);
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  updateBlock: async (
    fileId: string,
    blockId: string,
    content: { type: 'text' | 'link'; data: string }
  ) => {
    try {
      set({ isLoading: true, error: null });
      await TauriClient.block.writeBlock(fileId, blockId, content);
      await get().loadBlocks(fileId);
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteBlock: async (fileId: string, blockId: string) => {
    try {
      set({ isLoading: true, error: null });
      await TauriClient.block.deleteBlock(fileId, blockId);
      await get().loadBlocks(fileId);
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  selectBlock: (fileId: string, blockId: string | null) => {
    const files = new Map(get().files);
    const fileState = files.get(fileId);
    if (fileState) {
      files.set(fileId, { ...fileState, selectedBlockId: blockId });
      set({ files });
    }
  },

  // Getters
  getActiveFile: () => {
    const { activeFileId, files } = get();
    return activeFileId ? files.get(activeFileId) || null : null;
  },

  getBlocks: (fileId: string) => {
    return get().files.get(fileId)?.blocks || [];
  },

  getSelectedBlock: (fileId: string) => {
    const fileState = get().files.get(fileId);
    if (!fileState || !fileState.selectedBlockId) return null;
    return fileState.blocks.find((b) => b.id === fileState.selectedBlockId) || null;
  },

  // UI Actions
  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },
}));
