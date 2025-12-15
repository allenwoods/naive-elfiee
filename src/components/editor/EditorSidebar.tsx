import { useState } from 'react'
import {
  History,
  Shield,
  Bot,
  Clock,
  Pencil,
  Play,
  Plus,
  Lightbulb,
  UserPlus,
  FileText,
  User,
  Calendar,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { motion } from 'framer-motion'
import {
  useEditorStore,
  Block,
  Collaborator,
  AgentConfig,
  TimelineEvent as TimelineEventType,
} from '@/lib/mockStore'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'

// --- Types & Schemas ---

const agentConfigSchema = z.object({
  model: z.string(),
  apiKey: z.string().min(1, 'API Key is required'),
  systemPrompt: z.string().optional(),
})

type AgentConfigForm = z.infer<typeof agentConfigSchema>

// --- Components ---

const TimelineEvent = ({
  event,
  index,
}: {
  event: TimelineEventType
  index: number
}) => {
  // Use Pencil as default icon (TimelineEvent no longer has icon property)
  const EventIcon = Pencil

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative pb-6 pl-7 last:pb-0"
    >
      <div className="bg-border absolute top-6 bottom-0 left-[11px] w-px last:hidden" />
      <div className="bg-secondary border-border absolute top-0.5 left-0 flex h-[22px] w-[22px] items-center justify-center rounded-full border">
        <EventIcon className="text-muted-foreground h-3 w-3" />
      </div>
      <div className="space-y-1">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="text-foreground font-medium">{event.actor}</span>
          <span>•</span>
          <span>{event.timestamp}</span>
        </div>
        <p className="text-foreground text-sm">{event.description}</p>
      </div>
    </motion.div>
  )
}

const AgentConfigTab = ({ agentId }: { agentId: string }) => {
  const { agentConfigs, updateAgentConfig } = useEditorStore()
  const config = agentConfigs[agentId] || {
    model: 'gpt-4',
    apiKey: '',
    systemPrompt: '',
  }

  const form = useForm<AgentConfigForm>({
    resolver: zodResolver(agentConfigSchema),
    defaultValues: {
      model: config.model,
      apiKey: config.apiKey,
      systemPrompt: config.systemPrompt,
    },
  })

  const onSubmit = (data: AgentConfigForm) => {
    updateAgentConfig(agentId, {
      model: data.model,
      apiKey: data.apiKey,
      systemPrompt: data.systemPrompt || '',
    })
    toast.success('Agent configuration saved')
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
      <div className="space-y-2">
        <Label>Model</Label>
        <Select
          defaultValue={config.model}
          onValueChange={(v) => form.setValue('model', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4">GPT-4</SelectItem>
            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
            <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>API Key</Label>
        <Input
          type="password"
          placeholder="sk-..."
          {...form.register('apiKey')}
        />
        {form.formState.errors.apiKey && (
          <p className="text-destructive text-xs">
            {form.formState.errors.apiKey.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>System Prompt</Label>
        <Textarea
          rows={5}
          placeholder="You are a helpful assistant..."
          {...form.register('systemPrompt')}
        />
      </div>

      <Button type="submit" className="w-full">
        Save Configuration
      </Button>
    </form>
  )
}

const PermissionsTab = ({ documentId }: { documentId: string }) => {
  const { collaborators, addCollaborator } = useEditorStore()
  const docCollaborators = collaborators[documentId] || []

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {docCollaborators.map((collab) => (
          <div
            key={collab.id}
            className="bg-secondary/30 flex items-start justify-between rounded-lg p-3"
          >
            <div className="flex items-center gap-3">
              <div className="bg-accent/10 text-accent flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
                {collab.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{collab.name}</p>
                <Badge variant="outline" className="h-5 text-[10px]">
                  {collab.role}
                </Badge>
              </div>
            </div>
            <div className="flex max-w-[120px] flex-wrap justify-end gap-1">
              {collab.permissions.map((p) => (
                <span
                  key={p}
                  className="bg-background text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]"
                >
                  {p.split('.')[1]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={() => toast.info('Mock: Add Collaborator Dialog')}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Add Collaborator
      </Button>
    </div>
  )
}

// --- Main Views ---

const DocumentDetailsView = ({ documentId }: { documentId: string }) => {
  return (
    <Tabs defaultValue="info" className="flex flex-1 flex-col">
      <div className="border-border border-b px-4 pt-4">
        <TabsList className="h-auto w-full justify-start gap-4 bg-transparent p-0">
          <TabsTrigger
            value="info"
            className="data-[state=active]:border-accent rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Info
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="data-[state=active]:border-accent rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Permissions
          </TabsTrigger>
          <TabsTrigger
            value="agent"
            className="data-[state=active]:border-accent rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Agent
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <TabsContent value="info" className="mt-0 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Owner</span>
              <div className="flex items-center gap-2">
                <div className="bg-accent/20 text-accent flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
                  Y
                </div>
                <span className="text-sm">Yao</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Created</span>
              <span className="text-sm">Dec 05, 2025</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Status</span>
              <Badge variant="secondary">Draft</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase">
              Timeline
            </h3>
            <div className="pt-2">
              <TimelineEvent
                index={0}
                event={{
                  id: 'e1',
                  actor: 'Yao',
                  actorType: 'human',
                  action: 'Created',
                  timestamp: '10:00 AM',
                  description: 'Created document',
                }}
              />
              <TimelineEvent
                index={1}
                event={{
                  id: 'e2',
                  actor: 'Claude',
                  actorType: 'architect',
                  action: 'Edited',
                  timestamp: '10:05 AM',
                  description: 'Added initial blocks',
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="mt-0">
          <PermissionsTab documentId={documentId} />
        </TabsContent>

        <TabsContent value="agent" className="mt-0">
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium">Default Agent</h3>
            <div className="bg-accent/5 border-accent/20 flex items-center gap-3 rounded-lg border p-3">
              <Bot className="text-accent h-8 w-8" />
              <div>
                <p className="text-sm font-medium">Claude-architect</p>
                <p className="text-muted-foreground text-xs">
                  Configured for this doc
                </p>
              </div>
            </div>
          </div>
          <AgentConfigTab agentId="a1" />
        </TabsContent>
      </div>
    </Tabs>
  )
}

const BlockDetailsView = ({ block }: { block: Block }) => {
  return (
    <Tabs defaultValue="actions" className="flex flex-1 flex-col">
      <div className="border-border border-b px-4 pt-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Block Details</h2>
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {block.id}
          </p>
        </div>
        <TabsList className="h-auto w-full justify-start gap-4 bg-transparent p-0">
          <TabsTrigger
            value="actions"
            className="data-[state=active]:border-accent rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Actions
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:border-accent rounded-none px-1 pb-3 data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            History
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <TabsContent value="actions" className="mt-0 space-y-4">
          <div className="bg-secondary/30 space-y-3 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Bot className="text-accent h-8 w-8" />
              <div>
                <p className="text-sm font-medium">Ask Agent</p>
                <p className="text-muted-foreground text-xs">
                  Delegate this block
                </p>
              </div>
            </div>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground w-full">
              Run Agent on Block
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <TimelineEvent
            index={0}
            event={{
              id: 'e3',
              actor: 'Yao',
              actorType: 'human',
              action: 'Edited',
              timestamp: 'Today',
              description: 'Modified content',
            }}
          />
        </TabsContent>
      </div>
    </Tabs>
  )
}

// --- Main Component ---

export const EditorSidebar = () => {
  const { activeBlockId, activeDocumentId, blocks } = useEditorStore()

  // Find the active block object
  const activeBlock =
    activeDocumentId && activeBlockId
      ? blocks[activeDocumentId]?.find((b) => b.id === activeBlockId)
      : null

  if (!activeDocumentId) {
    return (
      <aside className="bg-card border-border text-muted-foreground flex w-[320px] items-center justify-center border-l">
        <p>No document selected</p>
      </aside>
    )
  }

  return (
    <aside className="bg-card border-border flex w-[320px] flex-col border-l">
      {activeBlock ? (
        <BlockDetailsView block={activeBlock} />
      ) : (
        <DocumentDetailsView documentId={activeDocumentId} />
      )}
    </aside>
  )
}
