import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileCode,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/app-store";
import type { Block } from "@/bindings";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ImportRepositoryModal } from "./ImportRepositoryModal";
import { OutlineTree, OutlineNode } from "./OutlineTree";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- Linked Repository Node (with conflict indicator) ---
export interface LinkedRepoFile {
  id: string;
  name: string;
  type: "file" | "folder";
  hasConflict?: boolean;
  conflictType?: "pending" | "conflict";
  conflictLine?: number;
  children?: LinkedRepoFile[];
  isExpanded?: boolean;
}

interface LinkedRepoNodeProps {
  node: LinkedRepoFile;
  depth?: number;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onOpenImportModal: () => void;
}

// Inline Edit Input Component
const InlineEditInput = ({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      className="flex-1 min-w-0 bg-transparent text-sm outline-none border-none focus:ring-1 focus:ring-primary/50 rounded px-1 py-0"
    />
  );
};

const LinkedRepoNode = ({
  node,
  depth = 0,
  onRename,
  onDelete,
  onToggleExpand,
  onOpenImportModal,
}: LinkedRepoNodeProps) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === "folder") {
      onToggleExpand(node.id);
    }
  };

  const handleSelect = () => {
    if (!isEditing) {
      toast.info(`Opening ${node.name} in editor`);
    }
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenImportModal();
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleRenameComplete = (newName: string) => {
    onRename(node.id, newName);
    setIsEditing(false);
  };

  const handleRenameCancel = () => {
    setIsEditing(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(node.id);
  };

  return (
    <div className="w-full">
      {/* Row Container */}
      <div
        className="group flex items-center w-full overflow-hidden pr-1 py-1.5 cursor-pointer rounded-md transition-colors hover:bg-muted/50 text-foreground"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={handleSelect}
      >
        {/* Left: Arrow + Icon (flex-shrink-0) */}
        <div className="flex items-center flex-shrink-0">
          {node.type === "folder" ? (
            <button
              onClick={handleToggle}
              className="w-4 h-4 flex items-center justify-center hover:bg-muted rounded z-10"
            >
              {node.isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          {node.type === "folder" ? (
            <Folder className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
          ) : (
            <FileCode className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
          )}
        </div>

        {/* Middle: Text or Input (flex-1 min-w-0 for shrinking) */}
        <div className="flex-1 min-w-0 ml-1.5 mr-2">
          {isEditing ? (
            <InlineEditInput
              initialValue={node.name}
              onSave={handleRenameComplete}
              onCancel={handleRenameCancel}
            />
          ) : (
            <span className="block text-left text-sm truncate">{node.name}</span>
          )}
        </div>

        {/* Right: Hover Actions (flex-shrink-0 ml-auto) */}
        <div className="flex items-center flex-shrink-0 ml-auto gap-1">
          {/* Hover actions */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleAddChild}
                className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                title="Import Repository"
              >
                <Plus className="w-3 h-3" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                    title="More Options"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={handleRenameClick}>
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {node.type === "folder" &&
        node.isExpanded &&
        node.children?.map((child) => (
          <LinkedRepoNode
            key={child.id}
            node={child}
            depth={depth + 1}
            onRename={onRename}
            onDelete={onDelete}
            onToggleExpand={onToggleExpand}
            onOpenImportModal={onOpenImportModal}
          />
        ))}
    </div>
  );
};

// --- Mock Linked Repositories Data (Clean - No Status Badges) ---
const mockLinkedRepos: LinkedRepoFile[] = [
  {
    id: "repo-1",
    name: "elfiee-pay-backend",
    type: "folder",
    isExpanded: true,
    children: [
      {
        id: "repo-1-src",
        name: "src",
        type: "folder",
        isExpanded: true,
        children: [
          { id: "repo-1-1", name: "api_v1.py", type: "file" },
          { id: "repo-1-2", name: "payment_handler.ts", type: "file" },
          { id: "repo-1-3", name: "config.json", type: "file" },
        ],
      },
      { id: "repo-1-4", name: "requirements.txt", type: "file" },
    ],
  },
  {
    id: "repo-2",
    name: "README.md",
    type: "file",
  },
];

// Outline nodes will be generated from blocks dynamically

// Helper function to update a node in a tree recursively
const updateNodeInTree = (
  nodes: LinkedRepoFile[],
  id: string,
  updater: (node: LinkedRepoFile) => LinkedRepoFile
): LinkedRepoFile[] => {
  return nodes.map((node) => {
    if (node.id === id) {
      return updater(node);
    }
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, id, updater) };
    }
    return node;
  });
};

// Helper function to delete a node from a tree recursively
const deleteNodeFromTree = (nodes: LinkedRepoFile[], id: string): LinkedRepoFile[] => {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => {
      if (node.children) {
        return { ...node, children: deleteNodeFromTree(node.children, id) };
      }
      return node;
    });
};

// --- Main Component ---
export const FilePanel = () => {
  const { currentFileId, selectedBlockId, getBlocks, selectBlock } = useAppStore();
  const [linkedRepos, setLinkedRepos] = useState(mockLinkedRepos);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const outlineTreeRef = useRef<{ addAtRoot: () => void } | null>(null);

  // Convert blocks to outline nodes
  const blocks = currentFileId ? getBlocks(currentFileId) : [];
  const outlineNodes: OutlineNode[] = blocks
    .filter(block => block.block_type === 'markdown' || block.block_type === 'document')
    .map(block => ({
      id: block.block_id,
      title: block.name,
      children: [],
    }));

  // Handle Import from modal
  const handleImportRepo = (name: string, source: string) => {
    setLinkedRepos((prev) => [
      ...prev,
      {
        id: `repo-${Date.now()}`,
        name,
        type: "folder",
        isExpanded: true,
        children: [{ id: `${Date.now()}-1`, name: "index.ts", type: "file" }],
      },
    ]);
    toast.success(`Imported "${name}" from ${source}`);
  };

  // Handle selecting a node in the outline tree
  const handleSelectNode = (id: string) => {
    selectBlock(id);
  };

  // Trigger add at root from header button
  const handleAddAtRoot = () => {
    const trigger = document.querySelector("[data-add-root-trigger]") as HTMLButtonElement;
    if (trigger) trigger.click();
  };

  // Handle rename for linked repos
  const handleRepoRename = (id: string, newName: string) => {
    setLinkedRepos((prev) => updateNodeInTree(prev, id, (node) => ({ ...node, name: newName })));
    toast.success(`Renamed to "${newName}"`);
  };

  // Handle delete for linked repos
  const handleRepoDelete = (id: string) => {
    setLinkedRepos((prev) => deleteNodeFromTree(prev, id));
    toast.success("Item deleted");
  };

  // Handle toggle expand for linked repos
  const handleRepoToggleExpand = (id: string) => {
    setLinkedRepos((prev) =>
      updateNodeInTree(prev, id, (node) => ({ ...node, isExpanded: !node.isExpanded }))
    );
  };

  // Handle open import modal (for inline + button)
  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
  };

  return (
    <aside className="w-full bg-secondary/30 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Breadcrumbs - Top of sidebar */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground hover:underline transition-colors">
            Projects
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate">elfiee-pay-demo.elf</span>
        </nav>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="py-2">
          {/* OUTLINE Section (Primary - Top) */}
          <div className="px-2 mb-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Outline
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleAddAtRoot}
                title="Create new document"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Advanced Outline Tree */}
            <OutlineTree
              initialNodes={outlineNodes}
              activeNodeId={selectedBlockId || undefined}
              onSelectNode={handleSelectNode}
            />
          </div>

          <Separator className="my-2" />

          {/* LINKED REPOSITORIES Section (Secondary - Bottom) */}
          <div className="px-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Linked Repos
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={() => setIsImportModalOpen(true)}
                title="Import repository"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="space-y-0.5">
              {linkedRepos.map((repo) => (
                <LinkedRepoNode
                  key={repo.id}
                  node={repo}
                  onRename={handleRepoRename}
                  onDelete={handleRepoDelete}
                  onToggleExpand={handleRepoToggleExpand}
                  onOpenImportModal={handleOpenImportModal}
                />
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Import Repository Modal */}
      <ImportRepositoryModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImport={handleImportRepo}
      />
    </aside>
  );
};
