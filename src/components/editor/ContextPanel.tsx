import { useMemo } from 'react'
import { Clock, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/lib/app-store'
import type { Block, Event, Grant, Editor } from '@/bindings'

const formatTime = (timestamp: Record<string, number>): string => {
  const max = Math.max(...Object.values(timestamp), 0)
  return max ? new Date(max * 1000).toLocaleTimeString() : '--'
}

const InfoTab = ({ block }: { block: Block | null }) => {
  if (!block) {
    return (
      <div className="text-sm text-muted-foreground">
        Select a block to view details.
      </div>
    )
  }
  const contents = block.contents as { markdown?: string }
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Name: {block.name}</p>
      <p>Type: {block.block_type}</p>
      <p>Owner: {block.owner}</p>
      <p>Block ID: {block.block_id}</p>
      <p>Content preview: {contents?.markdown?.slice(0, 80) || '—'}</p>
    </div>
  )
}

const CollaboratorsTab = ({
  block,
  editors,
  grants,
}: {
  block: Block | null
  editors: Editor[]
  grants: Grant[]
}) => {
  if (!block) {
    return (
      <div className="text-sm text-muted-foreground">No block selected.</div>
    )
  }
  const blockGrants = grants.filter((g) => g.block_id === block.block_id)
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      {blockGrants.length === 0 && <p>No grants for this block.</p>}
      {blockGrants.map((g) => {
        const editor = editors.find((e) => e.editor_id === g.editor_id)
        return (
          <div
            key={`${g.editor_id}-${g.cap_id}-${g.block_id}`}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <div>
                <p className="text-foreground">{editor?.name || g.editor_id}</p>
                <p className="text-xs text-muted-foreground">
                  Capability: {g.cap_id}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const TimelineTab = ({ events }: { events: Event[] }) => {
  if (events.length === 0) {
    return <div className="text-sm text-muted-foreground">No events yet.</div>
  }
  return (
    <div className="space-y-3">
      {events.map((e) => (
        <div
          key={e.event_id}
          className="flex items-center gap-3 rounded-lg border px-3 py-2"
        >
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm text-foreground">{e.attribute}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(e.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

const ContextPanel = () => {
  const {
    currentFileId,
    selectedBlockId,
    getBlock,
    getEvents,
    getEditors,
    getGrants,
  } = useAppStore()
  const block: Block | null =
    currentFileId && selectedBlockId
      ? getBlock(currentFileId, selectedBlockId) || null
      : null

  const events = useMemo(() => {
    if (!currentFileId) return []
    const all = getEvents(currentFileId)
    return block ? all.filter((e) => e.entity === block.block_id) : all
  }, [currentFileId, block, getEvents])

  const editors = useMemo(
    () => (currentFileId ? getEditors(currentFileId) : []),
    [currentFileId, getEditors]
  )
  const grants = useMemo(
    () => (currentFileId ? getGrants(currentFileId) : []),
    [currentFileId, getGrants]
  )

  if (!currentFileId) {
    return (
      <aside className="flex h-full w-full items-center justify-center bg-card text-muted-foreground">
        <p className="text-sm">No file opened</p>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col bg-card">
      <div className="shrink-0 border-b border-border px-4 pb-2 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Badge
            variant="outline"
            className="h-5 border-border px-2 text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            Scope
          </Badge>
          <span className="text-sm font-medium text-foreground">
            {block ? block.name : 'Blocks'}
          </span>
        </div>
      </div>

      <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border px-4">
          <TabsList className="h-auto w-full justify-start gap-4 bg-transparent p-0">
            <TabsTrigger
              value="info"
              className="rounded-none px-1 pb-3 text-sm text-muted-foreground data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Info
            </TabsTrigger>
            <TabsTrigger
              value="collaborators"
              className="rounded-none px-1 pb-3 text-sm text-muted-foreground data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Collaborators
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="rounded-none px-1 pb-3 text-sm text-muted-foreground data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-4">
            <TabsContent value="info" className="mt-0">
              <InfoTab block={block} />
            </TabsContent>

            <TabsContent value="collaborators" className="mt-0">
              <CollaboratorsTab
                block={block}
                editors={editors}
                grants={grants}
              />
            </TabsContent>

            <TabsContent value="timeline" className="mt-0">
              <TimelineTab events={events} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </aside>
  )
}

export default ContextPanel
