import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MoreHorizontal, Download } from 'lucide-react'
import { useAppStore } from '@/lib/app-store'
import { TauriClient } from '@/lib/tauri-client'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ImportRepositoryModal } from './ImportRepositoryModal'
import { VfsTree } from './VfsTree'
import type { VfsNode } from '@/utils/vfs-tree'
import { toast } from 'sonner'
import { open } from '@tauri-apps/plugin-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const FilePanel = () => {
  const { currentFileId, selectedBlockId, selectBlock, loadBlocks } =
    useAppStore()
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // Initialize Outline and load data
  useEffect(() => {
    if (currentFileId) {
      useAppStore.getState().ensureSystemOutline(currentFileId)
    }
  }, [currentFileId])

  // Selectors for trees
  const outlineTree = currentFileId
    ? useAppStore.getState().getOutlineTree(currentFileId)
    : []

  const linkedRepos = currentFileId
    ? useAppStore.getState().getLinkedRepos(currentFileId)
    : []

  // --- Handlers ---

  const handleSelect = (node: VfsNode) => {
    if (node.blockId) {
      selectBlock(node.blockId)
    }
  }

  const handleAddEntry = async (
    directoryBlockId: string,
    parentPath: string,
    type: 'file' | 'directory'
  ) => {
    if (!currentFileId) return

    const name = prompt(`Enter ${type} name:`)
    if (!name || !name.trim()) return

    const path = parentPath ? `${parentPath}/${name}` : name

    try {
      await TauriClient.directory.createEntry(
        currentFileId,
        directoryBlockId,
        path,
        type,
        { block_type: type === 'file' ? 'markdown' : undefined }
      )
      await loadBlocks(currentFileId)
      toast.success(`${type === 'file' ? 'Document' : 'Folder'} created`)
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

    try {
      await TauriClient.directory.renameEntry(
        currentFileId,
        directoryBlockId,
        node.path,
        node.path.includes('/')
          ? `${node.path.substring(0, node.path.lastIndexOf('/'))}/${newName}`
          : newName
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
        node.path
      )
      await loadBlocks(currentFileId)
      toast.success('Deleted successfully')
    } catch (error) {
      toast.error(`Failed to delete: ${error}`)
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

  const handleImportRepo = async (name: string) => {
    if (!currentFileId) return

    // Note: 'source' from modal is currently 'Local', 'Agentour', etc.
    // We need the actual absolute path. For now, we'll trigger a Tauri dialog
    // until the modal is fully updated to handle Tauri-native paths.
    try {
      const sourcePath = await open({
        directory: true,
        multiple: false,
        title: 'Select Folder to Import',
      })

      if (!sourcePath || typeof sourcePath !== 'string') return

      const folderName = name || sourcePath.split(/[\\\/]/).pop() || 'Imported'

      // Check for name collision in top-level directory blocks
      const existingNames = linkedRepos.map((r) => r.name)
      let uniqueName = folderName
      let counter = 1
      while (existingNames.includes(uniqueName)) {
        uniqueName = `${folderName} (${counter++})`
      }

      // 1. Create the Directory Block
      const events = await TauriClient.block.createBlock(
        currentFileId,
        uniqueName,
        'directory'
      )
      const createEvent = events.find((e) =>
        e.attribute.endsWith('/core.create')
      )
      const newBlockId = createEvent?.entity

      if (!newBlockId) throw new Error('Failed to create directory block')

      // 2. Import the directory contents
      await TauriClient.directory.importDirectory(
        currentFileId,
        newBlockId,
        sourcePath
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
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                        handleAddEntry('__system_outline__', '', 'file')
                      }
                    >
                      Add Document
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        handleAddEntry('__system_outline__', '', 'directory')
                      }
                    >
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
                        handleExport('__system_outline__', {
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
                handleAddEntry('__system_outline__', node.path, type)
              }
              onRename={(node, newName) =>
                handleRename('__system_outline__', node, newName)
              }
              onDelete={(node) => handleDelete('__system_outline__', node)}
              onExport={(node) => handleExport('__system_outline__', node)}
            />
          </div>

          <Separator className="my-2" />

          {/* LINKED REPOSITORIES Section */}
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
            <div className="space-y-4">
              {linkedRepos.map((repo) => (
                <div key={repo.blockId} className="space-y-1">
                  <div className="group flex items-center justify-between px-1">
                    <span className="truncate text-xs font-medium text-muted-foreground/80">
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <VfsTree
                    nodes={repo.tree}
                    activeBlockId={selectedBlockId}
                    onSelect={handleSelect}
                    onAddChild={(node, type) =>
                      handleAddEntry(repo.blockId, node.path, type)
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

      <ImportRepositoryModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImport={handleImportRepo}
      />
    </aside>
  )
}
