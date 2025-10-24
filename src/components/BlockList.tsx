/**
 * BlockList Component
 *
 * Displays all blocks for the active file and provides basic block operations
 */

import { useAppStore } from '@/lib/app-store';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { Block } from '@/lib/types';

function BlockItem({ block, fileId }: { block: Block; fileId: string }) {
  const { deleteBlock, selectBlock, getSelectedBlock } = useAppStore();
  const selectedBlock = getSelectedBlock(fileId);
  const isSelected = selectedBlock?.id === block.id;

  const handleDelete = async () => {
    await deleteBlock(fileId, block.id);
  };

  const handleSelect = () => {
    selectBlock(fileId, block.id);
  };

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
            {block.id}
          </div>
          <div className="text-sm break-words">
            {block.content.data || '(empty)'}
          </div>
          {block.parent_id && (
            <div className="text-xs text-muted-foreground mt-1">
              Parent: {block.parent_id}
            </div>
          )}
          {block.linked_to.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Links: {block.linked_to.length}
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
    if (!activeFileId) return;

    const content = prompt('Enter block content:');
    if (content === null) return;

    await createBlock(activeFileId, null, { type: 'text', data: content });
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
                key={block.id}
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
