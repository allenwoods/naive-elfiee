import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// --- Data Structure (Recursive) ---
export interface OutlineNode {
  id: string
  title: string
  children?: OutlineNode[]
  isExpanded?: boolean
}

// --- Inline Edit Input ---
interface InlineEditInputProps {
  initialValue: string
  onSave: (value: string) => void
  onCancel: () => void
  depth: number
}

const InlineEditInput = ({
  initialValue,
  onSave,
  onCancel,
  depth,
}: InlineEditInputProps) => {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = value.trim() || 'Untitled'
      onSave(trimmed)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const handleBlur = () => {
    const trimmed = value.trim() || 'Untitled'
    onSave(trimmed)
  }

  return (
    <div
      className="group flex w-full items-center overflow-hidden rounded-md bg-accent/10 py-1 pr-2 ring-2 ring-accent/50"
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      {/* Zone 1: Toggle placeholder */}
      <div className="h-5 w-5 flex-shrink-0" />

      {/* Zone 2: Icon */}
      <FileText className="h-4 w-4 flex-shrink-0 text-accent" />

      {/* Zone 3: Input */}
      <div className="ml-2 min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="h-6 w-full border-none bg-transparent p-0 text-sm font-medium text-foreground focus:outline-none focus:ring-0"
          placeholder="Untitled"
        />
      </div>
    </div>
  )
}

// --- Single Tree Node ---
interface TreeNodeProps {
  node: OutlineNode
  depth: number
  activeNodeId: string | null
  editingNodeId: string | null
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onAddChild: (parentId: string) => void
  onRename: (id: string, newTitle: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onStartRename: (id: string) => void
  onCancelRename: () => void
}

const TreeNode = ({
  node,
  depth,
  activeNodeId,
  editingNodeId,
  onSelect,
  onToggle,
  onAddChild,
  onRename,
  onDuplicate,
  onDelete,
  onStartRename,
  onCancelRename,
}: TreeNodeProps) => {
  const isActive = activeNodeId === node.id
  const isEditing = editingNodeId === node.id
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = node.isExpanded ?? true

  // Handle toggle click (arrow only)
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle(node.id)
  }

  // Handle title click (select document)
  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(node.id)
  }

  // Handle add child click
  const handleAddChildClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAddChild(node.id)
  }

  // Handle dropdown trigger click
  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // Handle rename action
  const handleRenameAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStartRename(node.id)
  }

  // Handle duplicate action
  const handleDuplicateAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDuplicate(node.id)
  }

  // Handle delete action
  const handleDeleteAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(node.id)
  }

  // If editing, show inline input
  if (isEditing) {
    return (
      <div className="w-full">
        <InlineEditInput
          initialValue={node.title}
          depth={depth}
          onSave={(newTitle) => onRename(node.id, newTitle)}
          onCancel={onCancelRename}
        />
        {/* Still render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="w-full">
            {node.children!.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                activeNodeId={activeNodeId}
                editingNodeId={editingNodeId}
                onSelect={onSelect}
                onToggle={onToggle}
                onAddChild={onAddChild}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onStartRename={onStartRename}
                onCancelRename={onCancelRename}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Row Container */}
      <div
        className={cn(
          'group flex w-full cursor-pointer items-center overflow-hidden rounded-md py-1 pr-1 transition-colors',
          isActive
            ? 'bg-accent/10 font-medium text-accent'
            : 'text-foreground hover:bg-muted/50'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Zone 1: Toggle (Arrow) */}
        <button
          onClick={handleToggleClick}
          className={cn(
            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-muted/80',
            !hasChildren && 'pointer-events-none opacity-0'
          )}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Icon */}
        <FileText
          className={cn(
            'ml-0.5 h-4 w-4 flex-shrink-0',
            isActive ? 'text-accent' : 'text-muted-foreground'
          )}
        />

        {/* Zone 2: Title (Content) - Clickable to select */}
        <div className="ml-2 mr-2 min-w-0 flex-1" onClick={handleTitleClick}>
          <span className="block select-none truncate text-left text-sm">
            {node.title}
          </span>
        </div>

        {/* Zone 3: Hover Actions */}
        <div className="ml-auto flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Add Child Button */}
          <button
            onClick={handleAddChildClick}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Add sub-document"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {/* More Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={handleDropdownClick}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="More options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={handleRenameAction}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteAction}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Render Children (if expanded) */}
      {hasChildren && isExpanded && (
        <div className="w-full">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              editingNodeId={editingNodeId}
              onSelect={onSelect}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onStartRename={onStartRename}
              onCancelRename={onCancelRename}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main Outline Tree Component ---
interface OutlineTreeProps {
  initialNodes?: OutlineNode[]
  activeNodeId: string | null
  onSelectNode: (id: string) => void
  onCreateNode?: (parentId: string | null, name: string) => void
  onRenameNode?: (id: string, newName: string) => void
  onDeleteNode?: (id: string) => void
}

export const OutlineTree = ({
  initialNodes,
  activeNodeId,
  onSelectNode,
  onCreateNode,
  onRenameNode,
  onDeleteNode,
}: OutlineTreeProps) => {
  const [nodes, setNodes] = useState<OutlineNode[]>(
    initialNodes || [
      {
        id: 'root-folder',
        title: 'Challenge System',
        isExpanded: true,
        children: [
          {
            id: 'doc-1',
            title: '需求验收标准 (Acceptance Criteria)',
            children: [],
          },
          { id: 'doc-2', title: '2. Point System', children: [] },
        ],
      },
    ]
  )
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [creatingInParentId, setCreatingInParentId] = useState<string | null>(
    null
  )
  const [isCreatingAtRoot, setIsCreatingAtRoot] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastCreatedParentRef = useRef<string | null>(null)
  const prevInitialNodesRef = useRef<OutlineNode[]>(initialNodes || [])

  // Sync with initialNodes when they change, preserving expansion state
  useEffect(() => {
    // Only run sync logic if initialNodes has actually changed
    if (initialNodes && initialNodes !== prevInitialNodesRef.current) {
      prevInitialNodesRef.current = initialNodes
      console.log(
        '[OutlineTree] Syncing initialNodes:',
        initialNodes.length,
        'nodes'
      )

      setNodes((currentNodes) => {
        // Create a set of currently expanded node IDs
        const expandedIds = new Set<string>()
        const collectExpanded = (nodes: OutlineNode[]) => {
          nodes.forEach((node) => {
            if (node.isExpanded) expandedIds.add(node.id)
            if (node.children) collectExpanded(node.children)
          })
        }
        collectExpanded(currentNodes)

        // Force expand the parent of the last created node
        if (lastCreatedParentRef.current) {
          expandedIds.add(lastCreatedParentRef.current)
          // We don't clear it immediately to ensure it stays expanded during potential multi-step updates
          // But we could rely on it being in expandedIds for future updates
        }

        // Apply expanded state to new nodes
        const applyExpanded = (nodes: OutlineNode[]): OutlineNode[] => {
          return nodes.map((node) => ({
            ...node,
            isExpanded: expandedIds.has(node.id) || node.isExpanded,
            children: node.children ? applyExpanded(node.children) : undefined,
          }))
        }

        const newNodes = applyExpanded(initialNodes)

        // Helper to find node recursively
        const findNodeRecursive = (
          nodes: OutlineNode[],
          id: string
        ): OutlineNode | undefined => {
          for (const node of nodes) {
            if (node.id === id) return node
            if (node.children) {
              const found = findNodeRecursive(node.children, id)
              if (found) return found
            }
          }
          return undefined
        }

        // If we are creating a new node, preserve it from currentNodes
        if (creatingInParentId || isCreatingAtRoot) {
          const creatingNode = editingNodeId
            ? findNodeRecursive(currentNodes, editingNodeId)
            : undefined

          if (creatingNode) {
            if (isCreatingAtRoot) {
              return [...newNodes, creatingNode]
            } else if (creatingInParentId) {
              // Add to specific parent
              const addTempChild = (items: OutlineNode[]): OutlineNode[] => {
                return items.map((item) => {
                  if (item.id === creatingInParentId) {
                    return {
                      ...item,
                      children: [creatingNode, ...(item.children || [])],
                    }
                  }
                  if (item.children) {
                    return { ...item, children: addTempChild(item.children) }
                  }
                  return item
                })
              }
              return addTempChild(newNodes)
            }
          }
        }

        return newNodes
      })
    }
  }, [initialNodes, editingNodeId, creatingInParentId, isCreatingAtRoot])

  // Toggle expand/collapse
  const handleToggle = useCallback((id: string) => {
    const toggleInTree = (items: OutlineNode[]): OutlineNode[] => {
      return items.map((item) => {
        if (item.id === id) {
          return { ...item, isExpanded: !item.isExpanded }
        }
        if (item.children) {
          return { ...item, children: toggleInTree(item.children) }
        }
        return item
      })
    }
    setNodes(toggleInTree)
  }, [])

  // Expand a specific node
  const expandNode = useCallback((id: string) => {
    const expandInTree = (items: OutlineNode[]): OutlineNode[] => {
      return items.map((item) => {
        if (item.id === id) {
          return { ...item, isExpanded: true }
        }
        if (item.children) {
          return { ...item, children: expandInTree(item.children) }
        }
        return item
      })
    }
    setNodes(expandInTree)
  }, [])

  // Add child to a parent node
  const handleAddChild = useCallback(
    (parentId: string) => {
      // 1. Expand the parent
      expandNode(parentId)

      // 2. Create a new "Untitled" node as first child
      const newNode: OutlineNode = {
        id: `node-${Date.now()}`,
        title: 'Untitled',
        isExpanded: true,
        children: [],
      }

      const addChildToTree = (items: OutlineNode[]): OutlineNode[] => {
        return items.map((item) => {
          if (item.id === parentId) {
            return {
              ...item,
              isExpanded: true,
              children: [newNode, ...(item.children || [])],
            }
          }
          if (item.children) {
            return { ...item, children: addChildToTree(item.children) }
          }
          return item
        })
      }

      setNodes(addChildToTree)
      // 3. Focus the new node for renaming
      setEditingNodeId(newNode.id)
      setCreatingInParentId(parentId)
    },
    [expandNode]
  )

  // Add node at root level
  const handleAddAtRoot = useCallback(() => {
    const newNode: OutlineNode = {
      id: `node-${Date.now()}`,
      title: 'Untitled',
      isExpanded: true,
      children: [],
    }
    setNodes((prev) => [...prev, newNode])
    setEditingNodeId(newNode.id)
    setIsCreatingAtRoot(true)

    // Scroll to bottom after state update
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight
      }
    }, 50)
  }, [])

  // Rename a node
  const handleRename = useCallback(
    (id: string, newTitle: string) => {
      if (creatingInParentId || isCreatingAtRoot) {
        // Creation mode: Call parent handler
        // Don't remove temp node immediately, perform optimistic update instead
        if (creatingInParentId) {
          lastCreatedParentRef.current = creatingInParentId
        }
        if (onCreateNode) {
          onCreateNode(creatingInParentId, newTitle)
        }
      } else {
        // Rename mode: Call parent handler
        if (onRenameNode) {
          onRenameNode(id, newTitle)
        }
      }

      // Optimistic update for both creation (temp node) and rename
      const renameInTree = (items: OutlineNode[]): OutlineNode[] => {
        return items.map((item) => {
          if (item.id === id) {
            return { ...item, title: newTitle }
          }
          if (item.children) {
            return { ...item, children: renameInTree(item.children) }
          }
          return item
        })
      }
      setNodes(renameInTree)

      setEditingNodeId(null)
      setCreatingInParentId(null)
      setIsCreatingAtRoot(false)
    },
    [creatingInParentId, isCreatingAtRoot, onCreateNode, onRenameNode]
  )

  // Cancel rename (remove if it was being created)
  const handleCancelRename = useCallback(() => {
    if (creatingInParentId || isCreatingAtRoot) {
      // Remove the newly created node
      const removeFromTree = (items: OutlineNode[]): OutlineNode[] => {
        return items
          .filter((item) => item.id !== editingNodeId)
          .map((item) => {
            if (item.children) {
              return { ...item, children: removeFromTree(item.children) }
            }
            return item
          })
      }
      setNodes(removeFromTree)
    }
    setEditingNodeId(null)
    setCreatingInParentId(null)
    setIsCreatingAtRoot(false)
  }, [creatingInParentId, isCreatingAtRoot, editingNodeId])

  // Start rename mode
  const handleStartRename = useCallback((id: string) => {
    setEditingNodeId(id)
    setCreatingInParentId(null)
    setIsCreatingAtRoot(false)
  }, [])

  // Duplicate a node
  const handleDuplicate = useCallback((id: string) => {
    const duplicateInTree = (items: OutlineNode[]): OutlineNode[] => {
      const result: OutlineNode[] = []
      for (const item of items) {
        result.push(item)
        if (item.id === id) {
          // Deep clone the node with new IDs
          const cloneNode = (node: OutlineNode): OutlineNode => ({
            ...node,
            id: `${node.id}-copy-${Date.now()}`,
            title: `${node.title} (copy)`,
            children: node.children?.map(cloneNode),
          })
          result.push(cloneNode(item))
        }
        if (item.children) {
          // Need to handle nested duplicates
        }
      }
      return result
    }

    // More sophisticated approach: find and duplicate at any level
    const duplicateAtLevel = (items: OutlineNode[]): OutlineNode[] => {
      const result: OutlineNode[] = []
      for (const item of items) {
        if (item.id === id) {
          result.push(item)
          // Clone with new ID
          const cloneNode = (node: OutlineNode): OutlineNode => ({
            ...node,
            id: `${node.id}-copy-${Date.now()}`,
            title: `${node.title} (copy)`,
            children: node.children?.map(cloneNode),
          })
          result.push(cloneNode(item))
        } else {
          result.push({
            ...item,
            children: item.children
              ? duplicateAtLevel(item.children)
              : undefined,
          })
        }
      }
      return result
    }

    setNodes(duplicateAtLevel)
    toast.success('Duplicated')
  }, [])

  // Delete a node
  const handleDelete = useCallback(
    (id: string) => {
      if (onDeleteNode) {
        onDeleteNode(id)
      }

      // Optimistic delete
      const deleteFromTree = (items: OutlineNode[]): OutlineNode[] => {
        return items
          .filter((item) => item.id !== id)
          .map((item) => {
            if (item.children) {
              return { ...item, children: deleteFromTree(item.children) }
            }
            return item
          })
      }
      setNodes(deleteFromTree)
    },
    [onDeleteNode]
  )

  return (
    <div className="w-full" ref={scrollContainerRef}>
      {/* Tree Nodes */}
      <div className="space-y-0.5">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            activeNodeId={activeNodeId}
            editingNodeId={editingNodeId}
            onSelect={onSelectNode}
            onToggle={handleToggle}
            onAddChild={handleAddChild}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onStartRename={handleStartRename}
            onCancelRename={handleCancelRename}
          />
        ))}
      </div>

      {/* Exposed method to add at root */}
      <button
        onClick={handleAddAtRoot}
        className="hidden"
        data-add-root-trigger
      />
    </div>
  )
}

// Export the add root trigger function for external use
export const useOutlineTreeRef = () => {
  const addAtRoot = useCallback(() => {
    const trigger = document.querySelector(
      '[data-add-root-trigger]'
    ) as HTMLButtonElement
    if (trigger) trigger.click()
  }, [])
  return { addAtRoot }
}
