import { useMemo, useState, useRef, useEffect } from 'react'
import { Calendar, Clock, User, FileText, Tag, Edit2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/lib/app-store'
import { CollaboratorList } from '@/components/permission/CollaboratorList'
import type { Block, Event } from '@/bindings'

const formatTime = (timestamp: Partial<{ [key: string]: number }>): string => {
  const values = Object.values(timestamp).filter(
    (v): v is number => v !== undefined
  )
  const max = values.length > 0 ? Math.max(...values, 0) : 0
  return max ? new Date(max * 1000).toLocaleTimeString() : '--'
}

const InfoTab = ({
  block,
  fileId,
}: {
  block: Block | null
  fileId: string | null
}) => {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { updateBlockMetadata } = useAppStore()

  // Extract metadata
  const metadata = block?.metadata as {
    description?: string
    created_at?: string
    updated_at?: string
  } | null
  const description = metadata?.description || ''
  const createdAt = metadata?.created_at
  const updatedAt = metadata?.updated_at

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-'
    try {
      return new Date(isoString).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } catch {
      return '-'
    }
  }

  // Start editing description
  const handleStartEdit = () => {
    setEditedDescription(description)
    setIsEditingDescription(true)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditingDescription(false)
    setEditedDescription('')
  }

  // Save description
  const handleSaveDescription = async () => {
    if (!fileId || !block) return

    setIsSaving(true)
    try {
      await updateBlockMetadata(fileId, block.block_id, {
        description: editedDescription,
      })
      setIsEditingDescription(false)
    } catch (error) {
      console.error('Failed to save description:', error)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (isEditingDescription && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
  }, [isEditingDescription])

  if (!block) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <FileText className="mb-3 h-10 w-10 opacity-20" />
        <p className="text-sm font-medium">No block selected</p>
        <p className="text-xs opacity-70">Select a block to view its details</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
            {block.name}
          </h2>
          <Badge
            variant="secondary"
            className="shrink-0 font-mono text-[10px] uppercase"
          >
            {block.block_type}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Description Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Description
          </h3>
          {!isEditingDescription && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleStartEdit}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {isEditingDescription ? (
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              value={editedDescription}
              onChange={(e) => {
                setEditedDescription(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              className="min-h-[80px] resize-none text-sm"
              placeholder="Add a description..."
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-3 text-xs"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={handleSaveDescription}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-muted/20 p-3 text-sm leading-relaxed text-foreground">
            {description ? (
              description
            ) : (
              <span className="italic text-muted-foreground/60">
                No description provided.
              </span>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Details Grid */}
      <div className="grid gap-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Tag className="h-3.5 w-3.5" />
          Details
        </h3>

        <div className="overflow-hidden rounded-lg border border-border/50 bg-background text-sm shadow-sm">
          {/* Owner Row */}
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>Owner</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
              <span className="font-semibold text-foreground">
                {block.owner}
              </span>
            </div>
          </div>

          <div className="grid gap-y-3 p-4">
            {createdAt && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 opacity-70" />
                  <span>Created</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDate(createdAt)}
                </span>
              </div>
            )}

            {updatedAt && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 opacity-70" />
                  <span>Updated</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDate(updatedAt)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const CollaboratorsTab = ({
  block,
  fileId,
}: {
  block: Block | null
  fileId: string | null
}) => {
  if (!block || !fileId) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/50 text-center">
        <div>
          <p className="text-sm text-muted-foreground">No block selected</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Select a block to manage collaborators
          </p>
        </div>
      </div>
    )
  }

  return (
    <CollaboratorList fileId={fileId} blockId={block.block_id} block={block} />
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
  const currentFileId = useAppStore((state) => state.currentFileId)
  const selectedBlockId = useAppStore((state) => state.selectedBlockId)
  const getEvents = useAppStore((state) => state.getEvents)

  // Subscribe to block changes by accessing it through a selector
  const block: Block | null = useAppStore((state) =>
    currentFileId && selectedBlockId
      ? state.getBlock(currentFileId, selectedBlockId) || null
      : null
  )

  const events = useMemo(() => {
    if (!currentFileId) return []
    const all = getEvents(currentFileId)
    return block ? all.filter((e) => e.entity === block.block_id) : all
  }, [currentFileId, block, getEvents])

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
              <InfoTab block={block} fileId={currentFileId} />
            </TabsContent>

            <TabsContent value="collaborators" className="mt-0">
              <CollaboratorsTab block={block} fileId={currentFileId} />
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
