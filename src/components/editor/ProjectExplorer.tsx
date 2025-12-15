import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
  Plus,
  Upload,
  FilePlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorStore, ImportedFile, Document } from '@/lib/mockStore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

// --- Components ---

const FileNode = ({
  node,
  depth = 0,
}: {
  node: ImportedFile
  depth?: number
}) => {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div>
      <div
        className={cn(
          'hover:bg-card/50 text-foreground flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-colors'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => node.type === 'folder' && setIsOpen(!isOpen)}
      >
        {node.type === 'folder' ? (
          <>
            {isOpen ? (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            )}
            <Folder className="text-muted-foreground h-4 w-4" />
          </>
        ) : (
          <>
            <span className="w-4" />
            <FileText className="text-muted-foreground h-4 w-4" />
          </>
        )}
        <span className="truncate text-sm">{node.name}</span>
      </div>

      {node.type === 'folder' &&
        isOpen &&
        node.children?.map((child) => (
          <FileNode key={child.id} node={child} depth={depth + 1} />
        ))}
    </div>
  )
}

const DocumentNode = ({
  doc,
  depth = 0,
}: {
  doc: Document
  depth?: number
}) => {
  const [isOpen, setIsOpen] = useState(true)
  const { activeDocumentId, setActiveDocument } = useEditorStore()
  const isActive = activeDocumentId === doc.id

  return (
    <div>
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-colors',
          isActive
            ? 'bg-card text-accent font-medium'
            : 'hover:bg-card/50 text-foreground'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => {
          if (doc.type === 'folder') {
            setIsOpen(!isOpen)
          } else {
            setActiveDocument(doc.id)
          }
        }}
      >
        {doc.type === 'folder' ? (
          <>
            {isOpen ? (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            )}
            <Folder className="text-muted-foreground h-4 w-4" />
          </>
        ) : (
          <>
            <span className="w-4" />
            <FileText
              className={cn(
                'h-4 w-4',
                isActive ? 'text-accent' : 'text-muted-foreground'
              )}
            />
          </>
        )}
        <span className="truncate text-sm">{doc.name}</span>
      </div>

      {doc.type === 'folder' &&
        isOpen &&
        doc.children?.map((child) => (
          <DocumentNode key={child.id} doc={child} depth={depth + 1} />
        ))}
    </div>
  )
}

const ImportDialog = () => {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState('')
  const { importFile } = useEditorStore()

  const handleImport = () => {
    if (!path) return

    // Mock import logic
    const name = path.split(/[/\\]/).pop() || 'unknown'
    const isFile = name.includes('.')

    importFile({
      id: `imported-${Date.now()}`,
      name,
      type: isFile ? 'file' : 'folder',
      path,
      children: isFile
        ? undefined
        : [
            {
              id: `child-${Date.now()}`,
              name: 'example.ts',
              type: 'file',
              path: `${path}/example.ts`,
            },
          ],
    })

    toast.success(`Imported ${name}`)
    setOpen(false)
    setPath('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import File or Folder</DialogTitle>
          <DialogDescription>
            Enter the local path to import. This is a mock action.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="path">Path</Label>
            <Input
              id="path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/path/to/file"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleImport}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const CreateDocDialog = () => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'markdown' | 'folder'>('markdown')
  const { createDocument } = useEditorStore()

  const handleCreate = () => {
    if (!name) return
    createDocument(null, name, type) // Always create at root for prototype
    toast.success(`Created ${name}`)
    setOpen(false)
    setName('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Document Name"
            />
          </div>
          <div className="flex gap-4">
            <Button
              variant={type === 'markdown' ? 'default' : 'outline'}
              onClick={() => setType('markdown')}
              size="sm"
            >
              Markdown
            </Button>
            <Button
              variant={type === 'folder' ? 'default' : 'outline'}
              onClick={() => setType('folder')}
              size="sm"
            >
              Folder
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Component ---

export const ProjectExplorer = ({
  activeProjectId,
}: {
  activeProjectId?: string
}) => {
  const { project } = useEditorStore()

  return (
    <aside className="bg-secondary/50 border-border flex h-full w-[250px] flex-col border-r">
      {/* Header */}
      <div className="border-border border-b p-4">
        <p className="text-muted-foreground mb-1 text-xs">Project</p>
        <h2 className="text-foreground flex items-center gap-2 truncate text-sm font-semibold">
          <Folder className="text-accent h-4 w-4" />
          {project.name}
        </h2>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-2">
          {/* Imported Files Section */}
          <div className="mb-4 px-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Imported
              </span>
              <ImportDialog />
            </div>
            <div className="space-y-1">
              {project.importedFiles.map((file) => (
                <FileNode key={file.id} node={file} />
              ))}
            </div>
          </div>

          <Separator className="my-2" />

          {/* Outline/Documents Section */}
          <div className="px-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Outline
              </span>
              <CreateDocDialog />
            </div>
            <div className="space-y-1">
              {project.documents.map((doc) => (
                <DocumentNode key={doc.id} doc={doc} />
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
