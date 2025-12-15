import { useState, useEffect } from 'react'
import { History, Shield, Bot, Clock, Code, Type } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/app-store'
import type { Block, Event, Editor, Grant } from '@/bindings'

interface AgentContextProps {
  selectedBlock: Block | null
  fileId: string | null
}

const getActionColor = (action: string) => {
  switch (action) {
    case 'EDITED':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'CREATED':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'DELETED':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    default:
      return 'bg-secondary text-muted-foreground'
  }
}

const getBlockTypeConfig = (blockType: string | undefined) => {
  switch (blockType) {
    case 'code':
      return {
        label: 'CODE',
        icon: Code,
        color: 'bg-accent/20 text-accent border-accent/30',
      }
    case 'markdown':
      return {
        label: 'MARKDOWN',
        icon: Type,
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      }
    default:
      return {
        label: 'BLOCK',
        icon: Type,
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      }
  }
}

const formatTimestamp = (timestamp: Record<string, number>): string => {
  // Simple timestamp formatting - can be improved
  const values = Object.values(timestamp)
  if (values.length === 0) return '00:00'
  const max = Math.max(...values)
  const hours = Math.floor(max / 3600) % 24
  const minutes = Math.floor((max % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const parseEventAction = (attribute: string): string => {
  const parts = attribute.split('/')
  if (parts.length < 2) return attribute
  const capId = parts[1]
  if (capId.includes('write')) return 'EDITED'
  if (capId.includes('create')) return 'CREATED'
  if (capId.includes('delete')) return 'DELETED'
  return capId.toUpperCase()
}

export const AgentContext = ({ selectedBlock, fileId }: AgentContextProps) => {
  const [activeTab, setActiveTab] = useState('history')
  const {
    getEvents,
    getEditors,
    getGrants,
    getBlockGrants,
    grantCapability,
    revokeCapability,
  } = useAppStore()
  const [events, setEvents] = useState<Event[]>([])
  const [editors, setEditors] = useState<Editor[]>([])
  const [grants, setGrants] = useState<Grant[]>([])

  useEffect(() => {
    if (fileId) {
      const fileEvents = getEvents(fileId)
      const blockEvents = selectedBlock
        ? fileEvents.filter((e) => e.entity === selectedBlock.block_id)
        : fileEvents
      setEvents(blockEvents.slice(-10).reverse()) // Last 10 events, newest first

      const fileEditors = getEditors(fileId)
      setEditors(fileEditors)

      if (selectedBlock) {
        const blockGrants = getBlockGrants(fileId, selectedBlock.block_id)
        setGrants(blockGrants)
      } else {
        const allGrants = getGrants(fileId)
        setGrants(allGrants)
      }
    }
  }, [fileId, selectedBlock, getEvents, getEditors, getGrants, getBlockGrants])

  const blockTypeConfig = getBlockTypeConfig(selectedBlock?.block_type)
  const BlockIcon = blockTypeConfig.icon

  const handleTogglePermission = async (
    editorId: string,
    capability: string,
    enabled: boolean
  ) => {
    if (!fileId || !selectedBlock) return

    if (enabled) {
      await revokeCapability(
        fileId,
        editorId,
        capability,
        selectedBlock.block_id
      )
    } else {
      await grantCapability(
        fileId,
        editorId,
        capability,
        selectedBlock.block_id
      )
    }
  }

  return (
    <aside className="bg-card border-border flex w-[320px] flex-col border-l">
      {/* Header */}
      <div className="border-border border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">
            Block Details
          </h2>
          <Badge
            variant="outline"
            className={`px-2 py-0.5 text-[10px] ${blockTypeConfig.color}`}
          >
            <BlockIcon className="mr-1 h-3 w-3" />
            {blockTypeConfig.label}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1.5 truncate text-xs">
          {selectedBlock ? selectedBlock.name : 'Select a block'}
        </p>
      </div>

      {/* Tabbed Interface */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col"
      >
        <TabsList className="border-border h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="history"
            className="data-[state=active]:border-accent rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:bg-transparent"
          >
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="data-[state=active]:border-accent rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:bg-transparent"
          >
            <Shield className="mr-2 h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger
            value="agent"
            className="data-[state=active]:border-accent rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:bg-transparent"
          >
            <Bot className="mr-2 h-4 w-4" />
            Editors
          </TabsTrigger>
        </TabsList>

        {/* History Tab */}
        <TabsContent value="history" className="mt-0 flex-1 overflow-auto p-4">
          <div className="space-y-1">
            {events.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-xs">
                No events yet
              </div>
            ) : (
              events.map((event, index) => {
                const [editorId] = event.attribute.split('/')
                const editor = editors.find((e) => e.editor_id === editorId)
                const action = parseEventAction(event.attribute)
                return (
                  <motion.div
                    key={event.event_id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative pb-4 pl-6 last:pb-0"
                  >
                    {/* Timeline line */}
                    {index < events.length - 1 && (
                      <div className="bg-border absolute top-6 bottom-0 left-[11px] w-px" />
                    )}

                    {/* Timeline dot */}
                    <div className="bg-secondary border-border absolute top-1 left-0 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2">
                      <span className="text-muted-foreground text-[10px] font-bold">
                        {editor?.name.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>

                    {/* Event content */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(event.timestamp)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`h-5 px-1.5 py-0 text-[10px] ${getActionColor(action)}`}
                        >
                          {action}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm font-medium">
                          {editor?.name || editorId}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent
          value="permissions"
          className="mt-0 flex-1 overflow-auto p-4"
        >
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Collaborator Permissions
            </h3>

            <div className="space-y-4">
              {editors.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-xs">
                  No editors available
                </div>
              ) : (
                editors.map((editor) => {
                  const editorGrants = grants.filter(
                    (g) => g.editor_id === editor.editor_id
                  )
                  const capabilities = [
                    'markdown.read',
                    'markdown.write',
                    'core.delete',
                  ]

                  return (
                    <div
                      key={editor.editor_id}
                      className="bg-secondary/30 space-y-3 rounded-xl p-4"
                    >
                      {/* User Info */}
                      <div className="flex items-center gap-3">
                        <div className="bg-accent/20 border-accent/30 flex h-8 w-8 items-center justify-center rounded-full border">
                          <span className="text-accent text-sm font-bold">
                            {editor.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <span className="text-foreground text-sm font-medium">
                            {editor.name}
                          </span>
                        </div>
                      </div>

                      {/* Permission Pills */}
                      <div className="flex flex-wrap gap-2">
                        {capabilities.map((cap) => {
                          const hasPermission = editorGrants.some(
                            (g) => g.cap_id === cap
                          )
                          return (
                            <button
                              key={cap}
                              onClick={() =>
                                handleTogglePermission(
                                  editor.editor_id,
                                  cap,
                                  hasPermission
                                )
                              }
                              className={cn(
                                'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors',
                                hasPermission
                                  ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                                  : 'bg-background border-border text-muted-foreground hover:border-accent/50 border'
                              )}
                            >
                              {cap.split('.').pop()?.toUpperCase() || cap}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </TabsContent>

        {/* Editors Tab */}
        <TabsContent value="agent" className="mt-0 flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Editors
            </h3>

            <div className="space-y-3">
              {editors.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-xs">
                  No editors available
                </div>
              ) : (
                editors.map((editor) => (
                  <motion.div
                    key={editor.editor_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-secondary/30 hover:border-accent/30 space-y-3 rounded-xl border border-transparent p-4 transition-colors"
                  >
                    {/* Editor Info */}
                    <div className="flex items-center gap-3">
                      <div className="bg-accent/20 border-accent/30 flex h-10 w-10 items-center justify-center rounded-full border">
                        <span className="text-accent text-sm font-bold">
                          {editor.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground text-sm font-medium">
                          {editor.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Editor ID: {editor.editor_id}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  )
}
