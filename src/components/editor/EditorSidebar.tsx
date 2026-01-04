import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/lib/app-store'
import type { Block } from '@/bindings'

// --- Main Views ---

const DocumentDetailsView = ({}: { documentId: string }) => {
  return (
    <Tabs defaultValue="info" className="flex flex-1 flex-col">
      <div className="border-b border-border px-4 pt-4">
        <TabsList className="h-auto w-full justify-start gap-4 bg-transparent p-0">
          <TabsTrigger
            value="info"
            className="rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Info
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Permissions
          </TabsTrigger>
          <TabsTrigger
            value="agent"
            className="rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Agent
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <TabsContent value="info" className="mt-0 space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a block to view details.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="mt-0">
          <div className="text-sm text-muted-foreground">
            Permissions are handled per block.
          </div>
        </TabsContent>

        <TabsContent value="agent" className="mt-0">
          <div className="text-sm text-muted-foreground">
            Agent configuration will be provided by Tauri backend.
          </div>
        </TabsContent>
      </div>
    </Tabs>
  )
}

const BlockDetailsView = ({ block }: { block: Block }) => {
  const { currentFileId, getEditors } = useAppStore()

  // Resolve owner info
  const editors = currentFileId ? getEditors(currentFileId) : []
  const ownerEditor = editors.find((e) => e.editor_id === block.owner)
  const ownerName = ownerEditor?.name || block.owner
  const ownerIdPreview = block.owner.slice(0, 8)

  return (
    <Tabs defaultValue="actions" className="flex flex-1 flex-col">
      <div className="border-b border-border px-4 pt-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Block Details</h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {block.block_id}
          </p>
        </div>
        <TabsList className="h-auto w-full justify-start gap-4 bg-transparent p-0">
          <TabsTrigger
            value="actions"
            className="rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Actions
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            History
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <TabsContent value="actions" className="mt-0 space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Name: {block.name}</p>
            <p>Type: {block.block_type}</p>
            <p className="flex items-center gap-1">
              Owner:{' '}
              <span className="font-medium text-foreground">{ownerName}</span>
              <span className="text-xs text-muted-foreground">
                ({ownerIdPreview}...)
              </span>
            </p>
          </div>
        </TabsContent>

        <TabsContent
          value="history"
          className="mt-0 text-sm text-muted-foreground"
        >
          Timeline events are available in AgentContext.
        </TabsContent>
      </div>
    </Tabs>
  )
}

// --- Main Component ---

export const EditorSidebar = () => {
  const { currentFileId, selectedBlockId, getBlock } = useAppStore()
  const activeBlock =
    currentFileId && selectedBlockId
      ? getBlock(currentFileId, selectedBlockId)
      : null

  if (!currentFileId) {
    return (
      <aside className="flex w-[320px] items-center justify-center border-l border-border bg-card text-muted-foreground">
        <p>No file opened</p>
      </aside>
    )
  }

  return (
    <aside className="flex w-[320px] flex-col border-l border-border bg-card">
      {activeBlock ? (
        <BlockDetailsView block={activeBlock} />
      ) : (
        <DocumentDetailsView documentId={currentFileId} />
      )}
    </aside>
  )
}
