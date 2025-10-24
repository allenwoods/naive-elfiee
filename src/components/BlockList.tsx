/**
 * BlockList Component
 *
 * Displays all blocks for the active file and provides basic block operations
 */

import { useAppStore } from '@/lib/app-store';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { Block } from '@/bindings';
import { message } from '@tauri-apps/plugin-dialog';

function BlockItem({ block, fileId }: { block: Block; fileId: string }) {
  const { deleteBlock, selectBlock, getSelectedBlock } = useAppStore();
  const selectedBlock = getSelectedBlock(fileId);
  const isSelected = selectedBlock?.block_id === block.block_id;

  const handleDelete = async () => {
    await deleteBlock(fileId, block.block_id);
  };

  const handleSelect = () => {
    selectBlock(fileId, block.block_id);
  };

  // Helper to display contents
  const displayContent = () => {
    if (typeof block.contents === 'string') return block.contents;
    if (typeof block.contents === 'object' && block.contents !== null) {
      return JSON.stringify(block.contents);
    }
    return '(empty)';
  };

  // Count children
  const childrenCount = Object.values(block.children || {}).reduce(
    (acc, arr) => acc + (arr?.length || 0),
    0
  );

  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-accent border-primary'
          : 'hover:bg-accent/50'
      }`}
      onClick={handleSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground mb-1">
            {block.name || block.block_id}
          </div>
          <div className="text-xs text-muted-foreground mb-1">
            Type: {block.block_type}
          </div>
          <div className="text-sm break-words">
            {displayContent()}
          </div>
          {childrenCount > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Children: {childrenCount}
            </div>
          )}
        </div>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          variant="ghost"
          size="icon"
          className="shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function BlockList() {
  const { activeFileId, getActiveFile, createBlock, isLoading } = useAppStore();
  const activeFile = getActiveFile();

  const handleCreateBlock = async () => {
    console.log('[BlockList] handleCreateBlock called');
    console.log('[BlockList] activeFileId:', activeFileId);

    if (!activeFileId) {
      console.log('[BlockList] No active file, returning');
      return;
    }

    // For MVP, we'll create a simple markdown block with timestamp as name
    // TODO: Replace with a proper dialog/input component
    const timestamp = new Date().toLocaleString();
    const blockName = `Block ${timestamp}`;
    console.log('[BlockList] Creating block with name:', blockName);

    console.log('[BlockList] Calling createBlock...');
    try {
      await createBlock(activeFileId, blockName, 'markdown');
      console.log('[BlockList] createBlock succeeded');
      await message('Block created successfully!', { title: 'Success', kind: 'info' });
    } catch (error) {
      console.error('[BlockList] createBlock failed:', error);
      await message(`Failed to create block: ${error}`, { title: 'Error', kind: 'error' });
    }
  };

  if (!activeFileId || !activeFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No file opened. Create or open a file to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Blocks</h2>
        <Button
          onClick={handleCreateBlock}
          disabled={isLoading}
          size="sm"
        >
          <Plus />
          New Block
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeFile.blocks.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No blocks yet. Create your first block!
          </div>
        ) : (
          <div className="space-y-2">
            {activeFile.blocks.map((block) => (
              <BlockItem
                key={block.block_id}
                block={block}
                fileId={activeFileId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
