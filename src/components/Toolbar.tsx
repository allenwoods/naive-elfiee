/**
 * Toolbar Component
 *
 * Provides file operations: New, Open, Save, Close
 */

import { useAppStore } from '@/lib/app-store';
import { Button } from '@/components/ui/button';
import { FilePlus, FolderOpen, Save, X } from 'lucide-react';

export function Toolbar() {
  const {
    activeFileId,
    createFile,
    openFile,
    saveFile,
    closeFile,
    isLoading,
  } = useAppStore();

  const handleSave = async () => {
    if (activeFileId) {
      await saveFile(activeFileId);
    }
  };

  const handleClose = async () => {
    if (activeFileId) {
      await closeFile(activeFileId);
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 border-b">
      <Button
        onClick={createFile}
        disabled={isLoading}
        variant="outline"
        size="sm"
      >
        <FilePlus />
        New
      </Button>

      <Button
        onClick={openFile}
        disabled={isLoading}
        variant="outline"
        size="sm"
      >
        <FolderOpen />
        Open
      </Button>

      <Button
        onClick={handleSave}
        disabled={isLoading || !activeFileId}
        variant="outline"
        size="sm"
      >
        <Save />
        Save
      </Button>

      <Button
        onClick={handleClose}
        disabled={isLoading || !activeFileId}
        variant="outline"
        size="sm"
      >
        <X />
        Close
      </Button>

      {activeFileId && (
        <div className="ml-auto text-sm text-muted-foreground">
          File: {activeFileId}
        </div>
      )}
    </div>
  );
}
