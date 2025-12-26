import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  MoreHorizontal,
  Download,
  FileUp,
  FolderUp,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/app-store'
import { TauriClient } from '@/lib/tauri-client'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ImportRepositoryModal } from './ImportRepositoryModal'
import { VfsTree } from './VfsTree'
import { CreateEntryDialog } from './CreateEntryDialog'
import type { VfsNode } from '@/utils/vfs-tree'
import { toast } from 'sonner'
import { open } from '@tauri-apps/plugin-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DirectoryContents {
  source: 'outline' | 'linked'
  entries?: Record<string, import('@/utils/vfs-tree').DirectoryEntry>
  [key: string]: unknown
}

const validateFilename = (name: string): string | null => {
  if (!name || name.trim().length === 0) return 'Filename cannot be empty'
  if (name.includes('/') || name.includes('\\'))
    return 'Filename cannot contain slashes'
  // Basic reserved characters check (Windows/Unix safe subset)
  if (/[<>:"|?*]/.test(name)) return 'Filename contains invalid characters'
  return null
}

// Helper to infer block type from filename
const inferBlockType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  return 'code'
}

export const FilePanel = () => {
  const {
    currentFileId,
    selectedBlockId,
    selectBlock,
    loadBlocks,
    getBlocks,
    getActiveEditor,
    getOutlineTree,
    getLinkedRepos,
  } = useAppStore()
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [createDialog, setCreateDialog] = useState({
    open: false,
    directoryBlockId: '',
    parentPath: '',
    type: 'file' as 'file' | 'directory',
    source: 'outline' as 'outline' | 'linked',
  })

  // Get active editor ID for operations
  const activeEditorId = currentFileId
    ? getActiveEditor(currentFileId)?.editor_id
    : undefined

  // Initialize Outline and load data
  useEffect(() => {
    if (currentFileId) {
      useAppStore.getState().ensureSystemOutline(currentFileId)
    }
  }, [currentFileId])

  // Selectors for trees - Memoized to prevent redundant sorting/building
  const outlineTree = useMemo(
    () => (currentFileId ? getOutlineTree(currentFileId) : []),
    [currentFileId, getOutlineTree]
  )

  const linkedRepos = useMemo(
    () => (currentFileId ? getLinkedRepos(currentFileId) : []),
    [currentFileId, getLinkedRepos]
  )

  // Find the block ID of the system outline (identified strictly by source="outline")
  const outlineBlockId = currentFileId
    ? getBlocks(currentFileId).find(
        (b) =>
          b.block_type === 'directory' &&
          (b.contents as unknown as DirectoryContents)?.source === 'outline'
      )?.block_id
    : null

  // --- Handlers ---

  const handleSelect = (node: VfsNode) => {
    if (node.blockId) {
      selectBlock(node.blockId)
    }
  }

  const openCreateDialog = (
    directoryBlockId: string,
    parentPath: string,
    type: 'file' | 'directory',
    source: 'outline' | 'linked'
  ) => {
    setCreateDialog({
      open: true,
      directoryBlockId,
      parentPath,
      type,
      source,
    })
  }

  const handleCreateConfirm = async (name: string) => {
    if (!currentFileId) return

    const error = validateFilename(name)
    if (error) {
      toast.error(error)
      return
    }

    const { directoryBlockId, parentPath, type, source } = createDialog
    const path = parentPath ? `${parentPath}/${name}` : name

    // Dynamic block type inference
    const blockType = type === 'file' ? inferBlockType(name) : undefined

    try {
      await TauriClient.directory.createEntry(
        currentFileId,
        directoryBlockId,
        path,
        type,
        {
          block_type: blockType,
          source,
        },
        activeEditorId
      )
      await loadBlocks(currentFileId)
      toast.success(
        `${type === 'file' ? (source === 'outline' ? 'Document' : 'File') : 'Folder'} created`
      )
    } catch (error) {
      toast.error(`Failed to create ${type}: ${error}`)
    }
  }

  const handleRename = async (
    directoryBlockId: string,
    node: VfsNode,
    newName: string
  ) => {
    if (!currentFileId) return

    const error = validateFilename(newName)
    if (error) {
      toast.error(error)
      return
    }

    try {
      await TauriClient.directory.renameEntry(
        currentFileId,
        directoryBlockId,
        node.path,
        node.path.includes('/')
          ? `${node.path.substring(0, node.path.lastIndexOf('/'))}/${newName}`
          : newName,
        activeEditorId
      )
      await loadBlocks(currentFileId)
      toast.success('Renamed successfully')
    } catch (error) {
      toast.error(`Failed to rename: ${error}`)
    }
  }

  const handleDelete = async (directoryBlockId: string, node: VfsNode) => {
    if (!currentFileId) return

    const confirmed = confirm(
      `Are you sure you want to delete "${node.name}"? This will also delete associated blocks.`
    )
    if (!confirmed) return

    try {
      await TauriClient.directory.deleteEntry(
        currentFileId,
        directoryBlockId,
        node.path,
        activeEditorId
      )
      await loadBlocks(currentFileId)
      toast.success('Deleted successfully')
    } catch (error) {
      toast.error(`Failed to delete: ${error}`)
    }
  }

  // Handle deleting an entire directory block (e.g., whole repo)
  const handleDeleteRepo = async (blockId: string, name: string) => {
    if (!currentFileId) return

    const confirmed = confirm(
      `Are you sure you want to delete "${name}"? This will remove the entire repository and all its contents.`
    )
    if (!confirmed) return

    try {
      await TauriClient.block.deleteBlock(
        currentFileId,
        blockId,
        activeEditorId
      )
      await loadBlocks(currentFileId)
      toast.success('Repository deleted successfully')
    } catch (error) {
      toast.error(`Failed to delete repository: ${error}`)
    }
  }

  const handleExport = async (directoryBlockId: string, node: VfsNode) => {
    if (!currentFileId) return

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: `Select Export Destination for ${node.name}`,
      })

      if (selected && typeof selected === 'string') {
        await TauriClient.directory.checkoutWorkspace(
          currentFileId,
          directoryBlockId,
          selected,
          node.path !== '' ? node.path : undefined
        )
        toast.success(`Exported to ${selected}`)
      }
    } catch (error) {
      toast.error(`Export failed: ${error}`)
    }
  }

  const handleImport = async (isFolder: boolean) => {
    if (!currentFileId) return

    try {
      const sourcePath = await open({
        directory: isFolder,
        multiple: false,
        title: isFolder ? 'Select Folder to Import' : 'Select File to Import',
      })

      if (!sourcePath || typeof sourcePath !== 'string') return

      const itemName = sourcePath.split(/[\\/]/).pop() || 'Imported'

      // Check for name collision in top-level directory blocks
      const existingNames = linkedRepos.map((r) => r.name)
      let uniqueName = itemName
      let counter = 1
      while (existingNames.includes(uniqueName)) {
        uniqueName = `${itemName} (${counter++})`
      }

      // 1. Create the Directory Block
      const events = await TauriClient.block.createBlock(
        currentFileId,
        uniqueName,
        'directory',
        activeEditorId,
        'linked'
      )
      const createEvent = events.find((e) =>
        e.attribute.endsWith('/core.create')
      )
      if (!createEvent) {
        throw new Error(
          'Failed to create directory block: no create event returned'
        )
      }
      const newBlockId = createEvent.entity

      // 2. Import the directory contents
      await TauriClient.directory.importDirectory(
        currentFileId,
        newBlockId,
        sourcePath,
        undefined,
        activeEditorId
      )

      await loadBlocks(currentFileId)
      toast.success(`Imported "${uniqueName}" successfully`)
    } catch (error) {
      toast.error(`Import failed: ${error}`)
    }
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-secondary/30">
      {/* Breadcrumbs */}
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
            {currentFileId ? 'Document Editor' : 'No Project Open'}
          </span>
        </nav>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-2">
          {/* OUTLINE Section */}
          <div className="mb-3 px-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span
                className={cn(
                  'cursor-pointer rounded-sm px-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                  outlineBlockId && selectedBlockId === outlineBlockId
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                onClick={() => outlineBlockId && selectBlock(outlineBlockId)}
              >
                Outline
              </span>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        outlineBlockId &&
                        openCreateDialog(outlineBlockId, '', 'file', 'outline')
                      }
                    >
                      <FileUp className="mr-2 h-3.5 w-3.5" />
                      Add Document
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        outlineBlockId &&
                        openCreateDialog(
                          outlineBlockId,
                          '',
                          'directory',
                          'outline'
                        )
                      }
                    >
                      <FolderUp className="mr-2 h-3.5 w-3.5" />
                      Add Folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        outlineBlockId &&
                        handleExport(outlineBlockId, {
                          path: '',
                          name: 'Outline',
                          type: 'directory',
                          blockId: null,
                          source: 'outline',
                          children: [],
                        })
                      }
                    >
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Export All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <VfsTree
              nodes={outlineTree}
              activeBlockId={selectedBlockId}
              onSelect={handleSelect}
              onAddChild={(node, type) =>
                outlineBlockId &&
                openCreateDialog(outlineBlockId, node.path, type, 'outline')
              }
              onRename={(node, newName) =>
                outlineBlockId && handleRename(outlineBlockId, node, newName)
              }
              onDelete={(node) =>
                outlineBlockId && handleDelete(outlineBlockId, node)
              }
              onExport={(node) =>
                outlineBlockId && handleExport(outlineBlockId, node)
              }
            />
          </div>

          <Separator className="my-2" />

          {/* LINKED REPOSITORIES Section */}
          <div className="px-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Linked Repos
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 flex-shrink-0 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleImport(false)}>
                    <FileUp className="mr-2 h-3.5 w-3.5" />
                    Import File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleImport(true)}>
                    <FolderUp className="mr-2 h-3.5 w-3.5" />
                    Import Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-4">
              {linkedRepos.map((repo) => (
                <div key={repo.blockId} className="space-y-1">
                  <div className="group flex items-center justify-between px-1">
                    <span
                      className={cn(
                        'cursor-pointer truncate rounded-sm px-1 text-xs font-medium transition-colors',
                        selectedBlockId === repo.blockId
                          ? 'bg-accent/10 text-accent'
                          : 'text-muted-foreground/80 hover:bg-muted hover:text-foreground'
                      )}
                      onClick={() => selectBlock(repo.blockId)}
                    >
                      {repo.name}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100">
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            openCreateDialog(repo.blockId, '', 'file', 'linked')
                          }
                        >
                          <FileUp className="mr-2 h-3.5 w-3.5" />
                          Add File
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            openCreateDialog(
                              repo.blockId,
                              '',
                              'directory',
                              'linked'
                            )
                          }
                        >
                          <FolderUp className="mr-2 h-3.5 w-3.5" />
                          Add Folder
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleExport(repo.blockId, {
                              path: '',
                              name: repo.name,
                              type: 'directory',
                              blockId: null,
                              source: 'linked',
                              children: [],
                            })
                          }
                        >
                          <Download className="mr-2 h-3.5 w-3.5" />
                          Export Project
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleDeleteRepo(repo.blockId, repo.name)
                          }
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <VfsTree
                    nodes={repo.tree}
                    activeBlockId={selectedBlockId}
                    onSelect={handleSelect}
                    onAddChild={(node, type) =>
                      openCreateDialog(repo.blockId, node.path, type, 'linked')
                    }
                    onRename={(node, newName) =>
                      handleRename(repo.blockId, node, newName)
                    }
                    onDelete={(node) => handleDelete(repo.blockId, node)}
                    onExport={(node) => handleExport(repo.blockId, node)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <CreateEntryDialog
        open={createDialog.open}
        onOpenChange={(open) => setCreateDialog((prev) => ({ ...prev, open }))}
        onConfirm={handleCreateConfirm}
        type={createDialog.type}
        parentPath={createDialog.parentPath}
        source={createDialog.source}
      />

      <ImportRepositoryModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImport={(_name, source) => {
          if (source === 'Local File') handleImport(false)
          else handleImport(true)
        }}
      />
    </aside>
  )
}
