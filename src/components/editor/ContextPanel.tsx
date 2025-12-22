import { useMemo, useState, useRef, useEffect } from 'react'
import { Clock, Shield, Edit2, Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/lib/app-store'
import type { Block, Event, Grant, Editor } from '@/bindings'

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

  // Extract metadata before early return
  const metadata = block?.metadata as {
    description?: string
    created_at?: string
    updated_at?: string
  } | null
  const description = metadata?.description || ''
  const createdAt = metadata?.created_at
  const updatedAt = metadata?.updated_at

  const formatDate = (isoString?: string) => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return null
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
      // Error toast is already shown by app-store
    } finally {
      setIsSaving(false)
    }
  }

  // Auto-focus and resize textarea when editing
  // This hook must be called before any early returns
  useEffect(() => {
    if (isEditingDescription && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      // Auto-resize
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
  }, [isEditingDescription])

  // Early return AFTER all hooks
  if (!block) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/50 text-center">
        <div>
          <p className="text-sm text-muted-foreground">No block selected</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Select a block to view its details
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Block Name - Prominent */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Name
        </p>
        <p className="text-base font-semibold text-foreground">{block.name}</p>
      </div>

      {/* Description - Always visible, editable */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </p>
          {!isEditingDescription && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleStartEdit}
            >
              <Edit2 className="h-3 w-3" />
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
                // Auto-resize
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              className="min-h-[60px] resize-none text-sm"
              placeholder="Enter a description for this block..."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={handleSaveDescription}
                disabled={isSaving}
              >
                <Check className="mr-1 h-3 w-3" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleCancelEdit}
              >
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-foreground">
            {description || (
              <span className="italic text-muted-foreground">
                No description yet. Click edit to add one.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Metadata Grid */}
      <div className="grid gap-3">
        <div className="flex items-center justify-between rounded-lg border border-border/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Type</p>
          <p className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {block.block_type}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Owner</p>
          <p className="text-xs font-medium text-foreground">{block.owner}</p>
        </div>

        {createdAt && (
          <div className="flex items-center justify-between rounded-lg border border-border/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Created</p>
            <p className="text-xs text-foreground">{formatDate(createdAt)}</p>
          </div>
        )}

        {updatedAt && (
          <div className="flex items-center justify-between rounded-lg border border-border/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Updated</p>
            <p className="text-xs text-foreground">{formatDate(updatedAt)}</p>
          </div>
        )}
      </div>

      {/* Block ID - Technical Info */}
      <div className="rounded-lg border border-border/30 bg-muted/10 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Block ID
        </p>
        <p className="break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
          {block.block_id}
        </p>
      </div>
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
  const currentFileId = useAppStore((state) => state.currentFileId)
  const selectedBlockId = useAppStore((state) => state.selectedBlockId)
  const getEvents = useAppStore((state) => state.getEvents)
  const getEditors = useAppStore((state) => state.getEditors)
  const getGrants = useAppStore((state) => state.getGrants)

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
              <InfoTab block={block} fileId={currentFileId} />
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
