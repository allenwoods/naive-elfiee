import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileCode,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useAppStore } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ImportRepositoryModal } from './ImportRepositoryModal'
import { OutlineTree, OutlineNode } from './OutlineTree'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// --- Linked Repository Node (with conflict indicator) ---
export interface LinkedRepoFile {
  id: string
  name: string
  type: 'file' | 'folder'
  hasConflict?: boolean
  conflictType?: 'pending' | 'conflict'
  conflictLine?: number
  children?: LinkedRepoFile[]
  isExpanded?: boolean
}

interface LinkedRepoNodeProps {
  node: LinkedRepoFile
  depth?: number
  onRename: (id: string, newName: string) => void
  onDelete: (id: string) => void
  onToggleExpand: (id: string) => void
  onOpenImportModal: () => void
}

// Inline Edit Input Component
const InlineEditInput = ({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string
  onSave: (value: string) => void
  onCancel: () => void
}) => {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSave = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onSave(trimmed)
    } else {
      onCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      className="min-w-0 flex-1 rounded border-none bg-transparent px-1 py-0 text-sm outline-none focus:ring-1 focus:ring-primary/50"
    />
  )
}

const LinkedRepoNode = ({
  node,
  depth = 0,
  onRename,
  onDelete,
  onToggleExpand,
  onOpenImportModal,
}: LinkedRepoNodeProps) => {
  const [isEditing, setIsEditing] = useState(false)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.type === 'folder') {
      onToggleExpand(node.id)
    }
  }

  const handleSelect = () => {
    if (!isEditing) {
      toast.info(`Opening ${node.name} in editor`)
    }
  }

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenImportModal()
  }

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleRenameComplete = (newName: string) => {
    onRename(node.id, newName)
    setIsEditing(false)
  }

  const handleRenameCancel = () => {
    setIsEditing(false)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(node.id)
  }

  return (
    <div className="w-full">
      {/* Row Container */}
      <div
        className="group flex w-full cursor-pointer items-center overflow-hidden rounded-md py-1.5 pr-1 text-foreground transition-colors hover:bg-muted/50"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={handleSelect}
      >
        {/* Left: Arrow + Icon (flex-shrink-0) */}
        <div className="flex flex-shrink-0 items-center">
          {node.type === 'folder' ? (
            <button
              onClick={handleToggle}
              className="z-10 flex h-4 w-4 items-center justify-center rounded hover:bg-muted"
            >
              {node.isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          {node.type === 'folder' ? (
            <Folder className="ml-0.5 h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <FileCode className="ml-0.5 h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Middle: Text or Input (flex-1 min-w-0 for shrinking) */}
        <div className="ml-1.5 mr-2 min-w-0 flex-1">
          {isEditing ? (
            <InlineEditInput
              initialValue={node.name}
              onSave={handleRenameComplete}
              onCancel={handleRenameCancel}
            />
          ) : (
            <span className="block truncate text-left text-sm">
              {node.name}
            </span>
          )}
        </div>

        {/* Right: Hover Actions (flex-shrink-0 ml-auto) */}
        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
          {/* Hover actions */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={handleAddChild}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Import Repository"
              >
                <Plus className="h-3 w-3" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="More Options"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={handleRenameClick}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {node.type === 'folder' &&
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
  )
}

// --- Mock Linked Repositories Data (Clean - No Status Badges) ---
const mockLinkedRepos: LinkedRepoFile[] = [
  {
    id: 'repo-1',
    name: 'elfiee-pay-backend',
    type: 'folder',
    isExpanded: true,
    children: [
      {
        id: 'repo-1-src',
        name: 'src',
        type: 'folder',
        isExpanded: true,
        children: [
          { id: 'repo-1-1', name: 'api_v1.py', type: 'file' },
          { id: 'repo-1-2', name: 'payment_handler.ts', type: 'file' },
          { id: 'repo-1-3', name: 'config.json', type: 'file' },
        ],
      },
      { id: 'repo-1-4', name: 'requirements.txt', type: 'file' },
    ],
  },
  {
    id: 'repo-2',
    name: 'README.md',
    type: 'file',
  },
]

// Outline nodes will be generated from blocks dynamically

// Helper function to update a node in a tree recursively
const updateNodeInTree = (
  nodes: LinkedRepoFile[],
  id: string,
  updater: (node: LinkedRepoFile) => LinkedRepoFile
): LinkedRepoFile[] => {
  return nodes.map((node) => {
    if (node.id === id) {
      return updater(node)
    }
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, id, updater) }
    }
    return node
  })
}

// Helper function to delete a node from a tree recursively
const deleteNodeFromTree = (
  nodes: LinkedRepoFile[],
  id: string
): LinkedRepoFile[] => {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => {
      if (node.children) {
        return { ...node, children: deleteNodeFromTree(node.children, id) }
      }
      return node
    })
}

// --- Main Component ---
export const FilePanel = () => {
  const {
    currentFileId,
    selectedBlockId,
    getBlocks,
    selectBlock,
    createBlock,
    renameBlock,
    deleteBlock,
  } = useAppStore()
  const [linkedRepos, setLinkedRepos] = useState(mockLinkedRepos)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // Convert blocks to outline nodes
  const blocks = currentFileId ? getBlocks(currentFileId) : []

  // Reconstruct tree structure from block relations
  const outlineNodes: OutlineNode[] = useMemo(() => {
    // 1. Map all blocks to OutlineNodes
    const nodeMap = new Map<string, OutlineNode>()
    blocks
      .filter(
        (block) =>
          block.block_type === 'markdown' || block.block_type === 'document'
      )
      .forEach((block) => {
        nodeMap.set(block.block_id, {
          id: block.block_id,
          title: block.name,
          children: [],
        })
      })

    // 2. Build the tree
    const rootNodes: OutlineNode[] = []
    const processedChildren = new Set<string>()

    // Identify children from block relations
    blocks.forEach((block) => {
      // If this block is in our map (is a displayable node)
      if (nodeMap.has(block.block_id)) {
        // Check its children - Handle potentially different property access or missing field
        const childrenMap = block.children as any
        const childrenIds =
          childrenMap?.children || childrenMap?.['children'] || []

        childrenIds.forEach((childId: string) => {
          const childNode = nodeMap.get(childId)
          const parentNode = nodeMap.get(block.block_id)

          if (childNode && parentNode) {
            // Add to parent's children
            parentNode.children = parentNode.children || []
            parentNode.children.push(childNode)
            processedChildren.add(childId)
          } else {
            if (!childNode)
              console.warn(`[FilePanel] Child node ${childId} not found in map`)
          }
        })
      }
    })

    // 3. Collect root nodes (nodes that are not children of any other node)
    nodeMap.forEach((node, id) => {
      if (!processedChildren.has(id)) {
        rootNodes.push(node)
      }
    })

    return rootNodes
  }, [blocks])

  // Handle Create Node (from OutlineTree)
  const handleCreateNode = async (parentId: string | null, name: string) => {
    if (!currentFileId) return
    try {
      await createBlock(currentFileId, name, 'markdown', parentId)
    } catch (error) {
      console.error('Failed to create block:', error)
    }
  }

  // Handle Rename Node (from OutlineTree)
  const handleRenameNode = async (id: string, newName: string) => {
    if (!currentFileId) return
    try {
      await renameBlock(currentFileId, id, newName)
    } catch (error) {
      console.error('Failed to rename block:', error)
    }
  }

  // Handle Delete Node (from OutlineTree)
  const handleDeleteNode = async (id: string) => {
    if (!currentFileId) return
    try {
      await deleteBlock(currentFileId, id)
    } catch (error) {
      console.error('Failed to delete block:', error)
    }
  }

  // Handle Import from modal
  const handleImportRepo = (name: string, source: string) => {
    setLinkedRepos((prev) => [
      ...prev,
      {
        id: `repo-${Date.now()}`,
        name,
        type: 'folder',
        isExpanded: true,
        children: [{ id: `${Date.now()}-1`, name: 'index.ts', type: 'file' }],
      },
    ])
    toast.success(`Imported "${name}" from ${source}`)
  }

  // Handle selecting a node in the outline tree
  const handleSelectNode = (id: string) => {
    selectBlock(id)
  }

  // Trigger add at root from header button
  const handleAddAtRoot = () => {
    const trigger = document.querySelector(
      '[data-add-root-trigger]'
    ) as HTMLButtonElement
    if (trigger) trigger.click()
  }

  // Handle rename for linked repos
  const handleRepoRename = (id: string, newName: string) => {
    setLinkedRepos((prev) =>
      updateNodeInTree(prev, id, (node) => ({ ...node, name: newName }))
    )
    toast.success(`Renamed to "${newName}"`)
  }

  // Handle delete for linked repos
  const handleRepoDelete = (id: string) => {
    setLinkedRepos((prev) => deleteNodeFromTree(prev, id))
    toast.success('Item deleted')
  }

  // Handle toggle expand for linked repos
  const handleRepoToggleExpand = (id: string) => {
    setLinkedRepos((prev) =>
      updateNodeInTree(prev, id, (node) => ({
        ...node,
        isExpanded: !node.isExpanded,
      }))
    )
  }

  // Handle open import modal (for inline + button)
  const handleOpenImportModal = () => {
    setIsImportModalOpen(true)
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-secondary/30">
      {/* Breadcrumbs - Top of sidebar */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            to="/"
            className="transition-colors hover:text-foreground hover:underline"
          >
            Projects
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-foreground">
            elfiee-pay-demo.elf
          </span>
        </nav>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-2">
          {/* OUTLINE Section (Primary - Top) */}
          <div className="mb-3 px-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Outline
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleAddAtRoot}
                title="Create new document"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Advanced Outline Tree */}
            <OutlineTree
              initialNodes={outlineNodes}
              activeNodeId={selectedBlockId}
              onSelectNode={handleSelectNode}
              onCreateNode={handleCreateNode}
              onRenameNode={handleRenameNode}
              onDeleteNode={handleDeleteNode}
            />
          </div>

          <Separator className="my-2" />

          {/* LINKED REPOSITORIES Section (Secondary - Bottom) */}
          <div className="px-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Linked Repos
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 flex-shrink-0 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setIsImportModalOpen(true)}
                title="Import repository"
              >
                <Plus className="h-3.5 w-3.5" />
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
  )
}
