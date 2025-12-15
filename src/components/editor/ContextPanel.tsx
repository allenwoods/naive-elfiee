import { useState, useEffect } from 'react'
import {
  Bot,
  Pencil,
  UserPlus,
  Play,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  User,
  Shield,
  Code,
  Settings,
  Eye,
  Search,
  Plus,
  MoreVertical,
  Trash2,
  FileText,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/app-store'
import type { Editor, Event, Grant } from '@/bindings'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

// --- Timeline Event Type (local UI type that extends store type with icon) ---
interface TimelineEventData {
  id: string
  timestamp: string
  actor: string
  actorType: 'human' | 'architect' | 'developer' | 'security'
  action: string
  description: string
  icon: React.ElementType
  content?: string
}

// --- Icon Map for Action Types ---
const actionIcons: Record<string, React.ElementType> = {
  Created: Pencil,
  Designed: Bot,
  Implemented: Bot,
  Executed: Play,
  Flagged: AlertTriangle,
  Conflict: AlertTriangle,
  Resolved: CheckCircle,
  Saved: CheckCircle,
  Edited: Pencil,
  Updated: Pencil,
  Deleted: Trash2,
}

// --- Badge Color Map for Action Types ---
const actionBadgeColors: Record<string, string> = {
  Created: 'bg-green-100 text-green-700 border-green-200',
  Updated: 'bg-blue-100 text-blue-700 border-blue-200',
  Deleted: 'bg-red-100 text-red-700 border-red-200',
  Saved: 'bg-gray-100 text-gray-700 border-gray-200',
  Designed: 'bg-purple-100 text-purple-700 border-purple-200',
  Implemented: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Executed: 'bg-amber-100 text-amber-700 border-amber-200',
  Flagged: 'bg-orange-100 text-orange-700 border-orange-200',
  Conflict: 'bg-red-100 text-red-700 border-red-200',
  Resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

// --- Icon Map for Actor Types ---
const actorIcons: Record<string, React.ElementType> = {
  human: User,
  architect: Bot,
  developer: Code,
  security: Shield,
}

// --- Available Agents ---
const availableAgents = [
  {
    id: 'architect',
    name: 'Architect',
    description: 'Designs system architecture and API schemas',
    icon: Bot,
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Implements code based on specifications',
    icon: Code,
  },
  {
    id: 'security',
    name: 'Security Auditor',
    description: 'Reviews code for security vulnerabilities',
    icon: Shield,
  },
]

// --- Permission Types ---
const permissionTypes = ['Read', 'Write', 'Delete'] as const
type PermissionType = (typeof permissionTypes)[number]

// --- Collaborator with Permissions ---
interface CollaboratorWithPermissions extends Collaborator {
  activePermissions: PermissionType[]
  isAgent: boolean
}

// --- Searchable Item for Add Modal ---
interface SearchableItem {
  id: string
  name: string
  type: 'human' | 'agent'
  description?: string
  icon: React.ElementType
}

// --- Timeline Event Component with Free Roam Navigation ---
// Minimalist audit log format: [Actor] [action] [Target] with file metadata below
const TimelineEvent = ({
  event,
  index,
  isCurrentlyViewing,
  isLatestHead,
  isGhosted,
  onRestore,
  currentFileName = 'elfiee-pay-demo.elf',
}: {
  event: TimelineEventData
  index: number
  isCurrentlyViewing: boolean
  isLatestHead: boolean
  isGhosted: boolean
  onRestore: (event: TimelineEventData, index: number) => void
  currentFileName?: string
}) => {
  const ActorIcon = actorIcons[event.actorType]
  const isNewEvent = event.timestamp === 'Just now'

  // Extract target from description (e.g., 'Updated "Activity Rules..."' -> 'Activity Rules')
  const extractTarget = (description: string): string => {
    const match = description.match(/"([^"]+)"/)
    if (match) return match[1].replace(/\.\.\.?$/, '')
    // Fallback: use description itself
    return description
  }

  const actionVerb = event.action.toLowerCase()
  const targetName = extractTarget(event.description)

  return (
    <motion.div
      initial={
        isNewEvent ? { opacity: 0, y: -20, scale: 0.95 } : { opacity: 0, x: 10 }
      }
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={{
        delay: isNewEvent ? 0 : index * 0.03,
        type: isNewEvent ? 'spring' : 'tween',
        stiffness: 300,
        damping: 25,
      }}
      className={cn(
        // Pre-reserved space: border always exists, only color changes
        'group relative rounded-lg border-2 px-3 py-3 transition-colors',
        // Active state: light orange bg + border
        isCurrentlyViewing
          ? 'border-[#F5E7E2] bg-[#F5E7E2]'
          : 'border-transparent bg-transparent',
        // Ghosted state for newer versions above active
        isGhosted && 'opacity-40',
        // New event highlight
        isNewEvent && 'ring-accent/30 ring-2 ring-offset-1'
      )}
    >
      {/* Main row: Avatar + Content - strict flexbox with gap */}
      <div className="flex flex-row items-start gap-3">
        {/* Avatar container - flex-shrink-0 to prevent squishing */}
        <div className="relative flex-shrink-0">
          {/* Timeline line - positioned relative to avatar */}
          <div
            className={cn(
              'absolute top-8 bottom-[-16px] left-1/2 w-px -translate-x-1/2',
              isGhosted ? 'bg-border/50' : 'bg-border'
            )}
          />

          {/* Icon circle */}
          <div
            className={cn(
              'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border',
              isCurrentlyViewing
                ? 'border-orange-400 bg-orange-50'
                : isGhosted
                  ? 'border-border/50 bg-muted/50'
                  : 'border-border bg-muted'
            )}
          >
            <ActorIcon
              className={cn(
                'h-4 w-4',
                isGhosted ? 'text-muted-foreground/50' : 'text-muted-foreground'
              )}
            />
          </div>
        </div>

        {/* Text content container - flex-1 takes remaining space */}
        <div className="relative flex min-h-[48px] min-w-0 flex-1 flex-col justify-center">
          {/* Audit Log Format: [Actor] [action] [Target] */}
          <p
            className={cn(
              'pr-16 text-sm leading-relaxed break-words whitespace-normal',
              isGhosted ? 'text-muted-foreground/50' : 'text-foreground'
            )}
          >
            <span className="font-semibold">{event.actor}</span>
            <span
              className={cn(
                'mx-1',
                isGhosted ? 'text-muted-foreground/50' : 'text-muted-foreground'
              )}
            >
              {actionVerb}
            </span>
            <span className="font-semibold">{targetName}</span>
            {isLatestHead && (
              <span className="bg-foreground text-background ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium">
                Latest
              </span>
            )}
            {isCurrentlyViewing && (
              <span className="ml-2 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                Viewing
              </span>
            )}
          </p>

          {/* Metadata Line: [File Icon] [Filename] • [Timestamp] */}
          <div
            className={cn(
              'mt-1 flex items-center gap-1.5 text-xs',
              isGhosted
                ? 'text-muted-foreground/40'
                : 'text-muted-foreground/70'
            )}
          >
            <FileText className="h-3 w-3" />
            <span className="cursor-pointer transition-colors hover:text-blue-500 hover:underline">
              {currentFileName}
            </span>
            <span>•</span>
            <span>{event.timestamp}</span>
          </div>

          {/* Restore Button - Absolute Positioned (No Layout Shift) */}
          {!isCurrentlyViewing && (
            <Button
              size="sm"
              variant="outline"
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted bg-background absolute right-0 bottom-0 h-7 text-xs opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                onRestore(event, index)
              }}
            >
              <RotateCcw className="mr-1.5 h-3 w-3" />
              Restore
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// --- Unified Add Collaborator Modal (Search-Based) ---
const AddCollaboratorModal = ({
  open,
  onOpenChange,
  onAddCollaborator,
  existingCollaborators,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddCollaborator: (item: SearchableItem) => void
  existingCollaborators: CollaboratorWithPermissions[]
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewAgentForm, setShowNewAgentForm] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentModel, setNewAgentModel] = useState('gpt-4')
  const [newAgentApiKey, setNewAgentApiKey] = useState('')
  const [newAgentPrompt, setNewAgentPrompt] = useState(
    'You are a helpful coding assistant.'
  )

  // Mock existing users and agents available to add
  const allItems: SearchableItem[] = [
    {
      id: 'user-1',
      name: 'Alice Chen',
      type: 'human',
      description: 'Frontend Engineer',
      icon: User,
    },
    {
      id: 'user-2',
      name: 'Bob Zhang',
      type: 'human',
      description: 'Backend Engineer',
      icon: User,
    },
    {
      id: 'user-3',
      name: 'Charlie Wang',
      type: 'human',
      description: 'Product Manager',
      icon: User,
    },
    ...availableAgents.map((a) => ({
      id: a.id,
      name: a.name,
      type: 'agent' as const,
      description: a.description,
      icon: a.icon,
    })),
  ]

  // Filter out already-added collaborators
  const existingIds = new Set(existingCollaborators.map((c) => c.id))
  const availableItems = allItems.filter((item) => !existingIds.has(item.id))

  // Filter by search query
  const filteredItems = availableItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelect = (item: SearchableItem) => {
    onAddCollaborator(item)
    setSearchQuery('')
    onOpenChange(false)
  }

  const handleCreateAgent = () => {
    if (!newAgentName.trim()) return
    const newAgent: SearchableItem = {
      id: `agent-custom-${Date.now()}`,
      name: newAgentName,
      type: 'agent',
      description: `Custom agent (${newAgentModel})`,
      icon: Bot,
    }
    onAddCollaborator(newAgent)
    toast.success(`Created and added "${newAgentName}"`)
    setNewAgentName('')
    setNewAgentModel('gpt-4')
    setNewAgentApiKey('')
    setNewAgentPrompt('You are a helpful coding assistant.')
    setShowNewAgentForm(false)
    onOpenChange(false)
  }

  const handleClose = () => {
    setSearchQuery('')
    setShowNewAgentForm(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Collaborator</DialogTitle>
        </DialogHeader>

        {!showNewAgentForm ? (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users or agents..."
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Results List */}
            <ScrollArea className="h-[280px]">
              <div className="space-y-2">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className="bg-background border-border hover:border-muted-foreground/30 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-md"
                      >
                        <div className="bg-muted border-border flex h-9 w-9 items-center justify-center rounded-full border">
                          <Icon className="text-muted-foreground h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-foreground text-sm font-medium">
                              {item.name}
                            </p>
                            <Badge
                              variant="outline"
                              className="border-border text-muted-foreground h-4 text-[10px]"
                            >
                              {item.type === 'human' ? 'Human' : 'Agent'}
                            </Badge>
                          </div>
                          {item.description && (
                            <p className="text-muted-foreground truncate text-xs">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground mb-2 text-sm">
                      No results found
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Try a different search or create a new agent
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Configure New Agent Link */}
            <Button
              variant="ghost"
              className="border-border text-muted-foreground hover:text-foreground w-full border border-dashed"
              onClick={() => setShowNewAgentForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Configure New Agent
            </Button>
          </div>
        ) : (
          /* New Agent Form (Inline) */
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agentName">Agent Name</Label>
              <Input
                id="agentName"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="My Custom Agent"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={newAgentModel} onValueChange={setNewAgentModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude-3.5">Claude 3.5</SelectItem>
                  <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={newAgentApiKey}
                onChange={(e) => setNewAgentApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={newAgentPrompt}
                onChange={(e) => setNewAgentPrompt(e.target.value)}
                rows={3}
                placeholder="Enter system prompt..."
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowNewAgentForm(false)}
              >
                Back
              </Button>
              <Button
                onClick={handleCreateAgent}
                disabled={!newAgentName.trim()}
              >
                Add Agent
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// --- Agent Config Modal ---
const AgentConfigModal = ({
  open,
  onOpenChange,
  agentName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentName?: string
}) => {
  const [model, setModel] = useState('gpt-4')
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful coding assistant.'
  )

  const handleSave = () => {
    toast.success('Agent configuration saved')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configure {agentName || 'Agent'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="claude-3.5">Claude 3.5</SelectItem>
                <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              placeholder="Enter system prompt..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Unified Collaborators Tab (Document Level - Global Permissions) ---
const CollaboratorsTab = ({ documentId }: { documentId: string }) => {
  // Initialize permissions from TEAM_MEMBERS (Single Source of Truth)
  const [permissions, setPermissions] = useState<
    Record<string, PermissionType[]>
  >(() => {
    const initial: Record<string, PermissionType[]> = {}
    TEAM_MEMBERS.forEach((member) => {
      if (member.isOwner) {
        initial[member.id] = ['Read', 'Write', 'Delete']
      } else if (member.isAgent) {
        initial[member.id] = ['Read', 'Write']
      } else {
        initial[member.id] = ['Read', 'Write']
      }
    })
    return initial
  })

  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [agentConfigOpen, setAgentConfigOpen] = useState(false)
  const [selectedAgentName, setSelectedAgentName] = useState<
    string | undefined
  >()
  const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false)

  // Track collaborators (including added ones)
  const [collaborators, setCollaborators] = useState<
    CollaboratorWithPermissions[]
  >(() => {
    return TEAM_MEMBERS.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.isAgent ? ('AGENT' as const) : ('HUMAN' as const),
      permissions: permissions[member.id] || [],
      activePermissions: permissions[member.id] || [],
      isAgent: member.isAgent,
    }))
  })

  const togglePermission = (memberId: string, permission: PermissionType) => {
    setPermissions((prev) => {
      const current = prev[memberId] || []
      const updated = current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission]
      return { ...prev, [memberId]: updated }
    })
    toast.success(`Permission "${permission}" toggled`)
  }

  const handleCardClick = (member: TeamMember) => {
    setExpandedCard(expandedCard === member.id ? null : member.id)
  }

  const handleConfigureAgent = (member: TeamMember) => {
    setSelectedAgentName(member.name)
    setAgentConfigOpen(true)
  }

  const handleAddCollaborator = (item: SearchableItem) => {
    // Check if already exists
    if (collaborators.some((c) => c.id === item.id)) {
      toast.error(`${item.name} is already a collaborator`)
      return
    }

    // Add new collaborator with default permissions
    const newCollaborator: CollaboratorWithPermissions = {
      id: item.id,
      name: item.name,
      role: item.type === 'agent' ? 'AGENT' : 'HUMAN',
      permissions:
        item.type === 'agent' ? ['Read', 'Write'] : ['Read', 'Write'],
      activePermissions:
        item.type === 'agent' ? ['Read', 'Write'] : ['Read', 'Write'],
      isAgent: item.type === 'agent',
    }

    setCollaborators((prev) => [...prev, newCollaborator])

    // Initialize permissions
    setPermissions((prev) => ({
      ...prev,
      [item.id]: item.type === 'agent' ? ['Read', 'Write'] : ['Read', 'Write'],
    }))

    toast.success(`Added ${item.name} as collaborator`)
  }

  const handleRemoveCollaborator = (memberId: string) => {
    setCollaborators((prev) => prev.filter((c) => c.id !== memberId))
    setPermissions((prev) => {
      const updated = { ...prev }
      delete updated[memberId]
      return updated
    })
    toast.success('Collaborator removed')
  }

  return (
    <div className="space-y-3">
      {/* Add Collaborator Button */}
      <Button
        variant="outline"
        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted w-full border-dashed"
        onClick={() => setAddCollaboratorOpen(true)}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Add Collaborator
      </Button>

      {/* Collaborators List */}
      {collaborators.map((collaborator) => {
        // Find matching team member for display
        const member = TEAM_MEMBERS.find((m) => m.id === collaborator.id) || {
          id: collaborator.id,
          name: collaborator.name,
          role: collaborator.isAgent ? 'AI Agent' : 'User',
          isAgent: collaborator.isAgent,
          isOwner: false,
          initials: collaborator.name.charAt(0).toUpperCase(),
          avatarColor: collaborator.isAgent ? 'bg-purple-500' : 'bg-gray-700',
        }

        const memberPermissions = permissions[collaborator.id] || []

        return (
          <div
            key={member.id}
            onClick={() => handleCardClick(member)}
            className="bg-background border-border hover:border-muted-foreground/30 group relative cursor-pointer rounded-lg border p-3 transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              {/* Avatar - Circular for humans, Rounded Square for agents */}
              <div
                className={cn(
                  'border-border flex h-8 w-8 items-center justify-center border',
                  member.isAgent ? 'rounded-md' : 'rounded-full',
                  member.avatarColor
                )}
              >
                {member.isAgent ? (
                  <Bot className="h-4 w-4 text-white" />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {member.initials}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-foreground text-sm font-medium">
                    {member.name}
                  </p>
                  {member.isOwner && (
                    <Badge
                      variant="outline"
                      className="h-4 border-orange-300 text-[9px] text-orange-600"
                    >
                      Owner
                    </Badge>
                  )}
                  {member.isAgent && (
                    <Badge
                      variant="outline"
                      className="border-border text-muted-foreground h-4 text-[9px]"
                    >
                      Bot
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">{member.role}</p>
              </div>
              {/* Three-Dot Context Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="hover:bg-muted absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100">
                    <MoreVertical className="text-muted-foreground h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {member.isAgent && (
                    <DropdownMenuItem
                      onClick={() => handleConfigureAgent(member)}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </DropdownMenuItem>
                  )}
                  {!member.isOwner && (
                    <DropdownMenuItem
                      onClick={() => handleRemoveCollaborator(member.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Permission Pills - High Contrast */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {permissionTypes.map((p) => {
                const isActive = memberPermissions.includes(p)
                return (
                  <button
                    key={p}
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePermission(member.id, p)
                    }}
                    className={cn(
                      'cursor-pointer rounded-full px-2.5 py-1 text-[11px] transition-all',
                      isActive
                        ? 'bg-gray-900 font-medium text-white'
                        : 'text-muted-foreground/50 hover:text-muted-foreground bg-transparent'
                    )}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <AgentConfigModal
        open={agentConfigOpen}
        onOpenChange={setAgentConfigOpen}
        agentName={selectedAgentName}
      />

      <AddCollaboratorModal
        open={addCollaboratorOpen}
        onOpenChange={setAddCollaboratorOpen}
        onAddCollaborator={handleAddCollaborator}
        existingCollaborators={collaborators}
      />
    </div>
  )
}

// --- Document Info Tab ---
const DocumentInfoTab = () => {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Title</span>
          <span className="text-foreground text-sm font-medium">
            Payment Integration
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Owner</span>
          <div className="flex items-center gap-2">
            <div className="bg-muted border-border flex h-6 w-6 items-center justify-center rounded-full border">
              <User className="text-muted-foreground h-3.5 w-3.5" />
            </div>
            <span className="text-foreground text-sm font-medium">Yao</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Created</span>
          <span className="text-foreground text-sm">Dec 05, 2025</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Status</span>
          <Badge
            variant="outline"
            className="border-border text-muted-foreground"
          >
            Draft
          </Badge>
        </div>
      </div>

      <div className="border-border border-t pt-4">
        <h4 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Description
        </h4>
        <p className="text-foreground text-sm leading-relaxed break-words whitespace-normal">
          Payment integration requirements for WeChat Pay and Alipay. Includes
          API schema design, implementation code, and security audit.
        </p>
      </div>
    </div>
  )
}

// --- Block Info Tab ---
const BlockInfoTab = ({ blockId }: { blockId: string }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Block Type</span>
          <Badge
            variant="outline"
            className="border-border text-muted-foreground font-mono"
          >
            Python Code
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            Last Modified By
          </span>
          <div className="flex items-center gap-2">
            <div className="bg-muted border-border flex h-6 w-6 items-center justify-center rounded-full border">
              <Bot className="text-muted-foreground h-3.5 w-3.5" />
            </div>
            <span className="text-foreground text-sm font-medium">
              Developer Agent
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Modified</span>
          <span className="text-foreground text-sm">10:25 AM</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Block ID</span>
          <span className="text-muted-foreground font-mono text-xs">
            {blockId}
          </span>
        </div>
      </div>
    </div>
  )
}

// --- Block Human Assignments Store (Isolated per Block ID) ---
// Track human assignments keyed by blockId to prevent state bleeding
const blockHumanAssignmentsStore: Record<string, Record<string, boolean>> = {}

const getBlockHumanAssignments = (blockId: string): Record<string, boolean> => {
  if (!blockHumanAssignmentsStore[blockId]) {
    blockHumanAssignmentsStore[blockId] = {}
  }
  return blockHumanAssignmentsStore[blockId]
}

const setBlockHumanAssignment = (
  blockId: string,
  userId: string,
  assigned: boolean
) => {
  if (!blockHumanAssignmentsStore[blockId]) {
    blockHumanAssignmentsStore[blockId] = {}
  }
  blockHumanAssignmentsStore[blockId][userId] = assigned
}

// --- Block Collaborators Tab (Handover) ---
// Core Feature: Assignment with Handover/Stop buttons - supports concurrent agents
// Uses TEAM_MEMBERS as Single Source of Truth
// Assignments are ISOLATED per Block ID
const BlockCollaboratorsTab = ({ blockId }: { blockId: string }) => {
  const {
    addAgentToBlock,
    removeAgentFromBlock,
    getBlockAgents,
    currentUser,
    addTimelineEvent,
  } = useEditorStore()
  const activeAgents = getBlockAgents(blockId)
  // Force re-render trigger for human assignments
  const [, forceUpdate] = useState(0)

  // Get assignments specific to THIS block
  const humanAssignments = getBlockHumanAssignments(blockId)

  const handleHandover = (member: TeamMember) => {
    if (member.isAgent) {
      // Agent assignment - add to concurrent active agents
      const agent = {
        id: member.id,
        name: member.name,
        initials: member.initials,
        color: member.avatarColor,
      }
      addAgentToBlock(blockId, agent)
      toast.success(`${member.name} is now working on this block...`)
    } else {
      // Human assignment - mark as assigned for THIS block only
      setBlockHumanAssignment(blockId, member.id, true)
      forceUpdate((n) => n + 1) // Trigger re-render
      addTimelineEvent({
        actor: currentUser.name,
        actorType: currentUser.actorType,
        action: 'Assigned',
        description: `Assigned "${member.name}" to block`,
        blockId,
      })
      toast.success(`Assigned "${member.name}" to this block`)
    }
  }

  const handleStop = (member: TeamMember) => {
    if (member.isAgent) {
      removeAgentFromBlock(blockId, member.id)
      toast.success(`Stopped ${member.name}`)
    } else {
      setBlockHumanAssignment(blockId, member.id, false)
      forceUpdate((n) => n + 1) // Trigger re-render
      toast.success(`${member.name} unassigned`)
    }
  }

  // Get assignment state for a team member (scoped to THIS block)
  const getAssignmentState = (member: TeamMember) => {
    if (member.isAgent) {
      return activeAgents.some((a) => a.id === member.id) ? 'working' : 'idle'
    }
    return humanAssignments[member.id] ? 'assigned' : 'idle'
  }

  const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false)

  // Track collaborators for this block
  const [blockCollaborators, setBlockCollaborators] = useState<
    CollaboratorWithPermissions[]
  >(() => {
    return TEAM_MEMBERS.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.isAgent ? ('AGENT' as const) : ('HUMAN' as const),
      permissions: [],
      activePermissions: [],
      isAgent: member.isAgent,
    }))
  })

  const handleAddCollaborator = (item: SearchableItem) => {
    // Check if already exists
    if (blockCollaborators.some((c) => c.id === item.id)) {
      toast.error(`${item.name} is already a collaborator`)
      return
    }

    // Add new collaborator
    const newCollaborator: CollaboratorWithPermissions = {
      id: item.id,
      name: item.name,
      role: item.type === 'agent' ? 'AGENT' : 'HUMAN',
      permissions: [],
      activePermissions: [],
      isAgent: item.type === 'agent',
    }

    setBlockCollaborators((prev) => [...prev, newCollaborator])
    toast.success(`Added ${item.name} as collaborator`)
  }

  const handleRemoveCollaborator = (memberId: string) => {
    // Remove from assignments
    const member = TEAM_MEMBERS.find((m) => m.id === memberId)
    if (member) {
      handleStop(member)
    }
    setBlockCollaborators((prev) => prev.filter((c) => c.id !== memberId))
    toast.success('Collaborator removed')
  }

  // Merge block collaborators with TEAM_MEMBERS for display
  const allBlockMembers = [
    ...TEAM_MEMBERS,
    ...blockCollaborators.filter(
      (c) => !TEAM_MEMBERS.some((m) => m.id === c.id)
    ),
  ]

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
        Handover Responsibility
      </p>

      {/* Add Collaborator Button */}
      <Button
        variant="outline"
        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted w-full border-dashed"
        onClick={() => setAddCollaboratorOpen(true)}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Add Collaborator
      </Button>

      {allBlockMembers.map((member) => {
        const state = getAssignmentState(member)
        const isWorking = state === 'working'
        const isAssigned = state === 'assigned'

        return (
          <div
            key={member.id}
            className={cn(
              'group rounded-lg border p-3 transition-all',
              // State 2: Active (Agent) - Light Orange background
              isWorking && 'border-[#EB5528]/30 bg-[#F5E7E2]',
              // State 3: Active (Human) - White/subtle gray
              isAssigned && 'bg-background border-muted-foreground/30',
              // State 1: Idle - Default white
              state === 'idle' &&
                'bg-background border-border hover:border-muted-foreground/30 hover:shadow-md'
            )}
          >
            <div className="flex items-center gap-3">
              {/* Avatar - Circular for humans, Rounded Square for agents */}
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center border',
                  member.isAgent ? 'rounded-md' : 'rounded-full',
                  isWorking
                    ? 'border-[#EB5528]/30 bg-[#EB5528]/20'
                    : member.avatarColor
                )}
              >
                {member.isAgent ? (
                  <Bot
                    className={cn(
                      'h-4 w-4',
                      isWorking ? 'text-[#EB5528]' : 'text-white'
                    )}
                  />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {member.initials}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isWorking ? 'text-[#EB5528]' : 'text-foreground'
                    )}
                  >
                    {member.name}
                  </p>
                  {member.isOwner && (
                    <Badge
                      variant="outline"
                      className="h-4 border-orange-300 text-[9px] text-orange-600"
                    >
                      Owner
                    </Badge>
                  )}
                  {member.isAgent && (
                    <Badge
                      variant="outline"
                      className="border-border text-muted-foreground h-4 text-[10px]"
                    >
                      Bot
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {member.isAgent ? member.description : member.role}
                </p>
              </div>

              {/* State-based Action/Status */}
              {state === 'idle' ? (
                // State 1: Idle - Show "Handover" button (Black/Dark)
                <Button
                  size="sm"
                  className="bg-foreground text-background hover:bg-foreground/90 h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleHandover(member)
                  }}
                >
                  Handover
                </Button>
              ) : isWorking ? (
                // State 2: Active Agent - "Stop" button + "Writing..."
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-[#EB5528] text-xs text-[#EB5528] hover:bg-[#EB5528]/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleStop(member)
                  }}
                >
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Stop
                </Button>
              ) : (
                // State 3: Active Human - Checkmark + "Assigned"
                <div
                  className="flex cursor-pointer items-center gap-1.5 px-2 py-1 hover:opacity-70"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleStop(member)
                  }}
                >
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-600">
                    Assigned
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <AddCollaboratorModal
        open={addCollaboratorOpen}
        onOpenChange={setAddCollaboratorOpen}
        onAddCollaborator={handleAddCollaborator}
        existingCollaborators={blockCollaborators}
      />
    </div>
  )
}

// --- Block Agent Tab (Execution) ---
const BlockAgentTab = ({ blockId }: { blockId: string }) => {
  const [configOpen, setConfigOpen] = useState(false)
  const [selectedAgentName, setSelectedAgentName] = useState<
    string | undefined
  >()
  const { runAgent, addAgentToBlock } = useEditorStore()

  // Agent color mapping
  const agentColors: Record<string, string> = {
    architect: 'bg-purple-500',
    developer: 'bg-blue-500',
    security: 'bg-green-500',
  }

  const handleRunAgent = (agent: (typeof availableAgents)[0]) => {
    // Add agent to block - supports concurrent agents
    const activeAgent = {
      id: agent.id,
      name: agent.name,
      initials: agent.name.charAt(0),
      color: agentColors[agent.id] || 'bg-gray-500',
    }
    addAgentToBlock(blockId, activeAgent)
    toast.success(`${agent.name} is now working on this block...`)
    runAgent(blockId, agent.id)
  }

  const handleConfigureAgent = (agent: (typeof availableAgents)[0]) => {
    setSelectedAgentName(agent.name)
    setConfigOpen(true)
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
        Run Agent on This Block
      </p>
      {availableAgents.map((agent) => {
        const Icon = agent.icon
        return (
          <div
            key={agent.id}
            className="bg-background border-border hover:border-muted-foreground/30 rounded-lg border p-3 transition-all hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-3">
              <div className="bg-muted border-border flex h-8 w-8 items-center justify-center rounded-md border">
                <Icon className="text-muted-foreground h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium">
                  {agent.name}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {agent.description}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground h-8 w-full text-xs"
              onClick={() => handleRunAgent(agent)}
            >
              Let them handle this
            </Button>
          </div>
        )
      })}
      <AgentConfigModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        agentName={selectedAgentName}
      />
    </div>
  )
}

// --- Timeline Tab with Free Roam Navigation ---
const TimelineTab = ({
  onContentPreview,
}: {
  onContentPreview: (content: string | null) => void
}) => {
  const { timelineEvents } = useEditorStore()

  // Convert store events to UI events with icons
  const events: TimelineEventData[] = timelineEvents.map((event) => ({
    ...event,
    icon: actionIcons[event.action] || Pencil,
  }))

  const latestHeadIndex = events.length - 1
  const [currentlyViewingIndex, setCurrentlyViewingIndex] =
    useState(latestHeadIndex)

  // Update viewing index when new events are added
  useEffect(() => {
    setCurrentlyViewingIndex(events.length - 1)
  }, [events.length])

  const { restoreContent } = useEditorStore()

  const handleRestore = (event: TimelineEventData, index: number) => {
    // Update viewing index
    setCurrentlyViewingIndex(index)
    // Restore content to main editor
    if (event.content) {
      restoreContent(event.content)
      toast.success(`Restored content from ${event.timestamp}`)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase">
        Activity Timeline
      </h3>
      <p className="text-muted-foreground mb-4 text-xs">
        Click "Restore" to view a past version.
      </p>
      {/* Gap between items (mb-3 = 12px) */}
      <div className="flex flex-col gap-3">
        {events.map((event, index) => {
          // Ghosting: versions NEWER than currently viewing (index > currentlyViewingIndex means older in timeline)
          // Timeline is displayed with newest at bottom (higher index = newer)
          // So versions with index > currentlyViewingIndex are "future" and should be ghosted
          const isGhosted = index > currentlyViewingIndex

          return (
            <TimelineEvent
              key={event.id}
              event={event}
              index={index}
              isCurrentlyViewing={index === currentlyViewingIndex}
              isLatestHead={index === latestHeadIndex}
              isGhosted={isGhosted}
              onRestore={handleRestore}
            />
          )
        })}
      </div>
    </div>
  )
}

// --- Main Component ---
export const ContextPanel = () => {
  const { activeDocumentId, activeBlockId, activeBlockName } = useEditorStore()
  const [previewContent, setPreviewContent] = useState<string | null>(null)

  const isBlockMode = !!activeBlockId
  const contextLabel = isBlockMode
    ? activeBlockName || `Block #${activeBlockId?.slice(-4)}`
    : 'Document'

  const defaultTab = 'info'

  if (!activeDocumentId) {
    return (
      <aside className="bg-card text-muted-foreground flex h-full w-full items-center justify-center">
        <p className="text-sm">No document selected</p>
      </aside>
    )
  }

  return (
    <aside className="bg-card flex h-full w-full flex-col">
      {/* Context Header */}
      <div className="border-border shrink-0 border-b px-4 pt-4 pb-2">
        <div className="mb-3 flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-border text-muted-foreground h-5 px-2 text-[10px] tracking-wide uppercase"
          >
            Scope
          </Badge>
          <span className="text-foreground text-sm font-medium">
            {contextLabel}
          </span>
        </div>
      </div>

      {/* Preview Overlay (for scrubbing) */}
      <AnimatePresence>
        {previewContent && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-muted border-border absolute top-24 right-4 left-4 z-10 rounded-lg border p-4 shadow-lg"
          >
            <div className="mb-2 flex items-center gap-2">
              <Eye className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs font-medium uppercase">
                Preview
              </span>
            </div>
            <pre className="text-foreground font-mono text-xs whitespace-pre-wrap">
              {previewContent}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
        <div className="border-border shrink-0 border-b px-4">
          <TabsList className="h-auto w-full justify-start gap-4 bg-transparent p-0">
            <TabsTrigger
              value="info"
              className="data-[state=active]:border-foreground data-[state=active]:text-foreground text-muted-foreground rounded-none px-1 pb-3 text-sm data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Info
            </TabsTrigger>
            <TabsTrigger
              value="collaborators"
              className="data-[state=active]:border-foreground data-[state=active]:text-foreground text-muted-foreground rounded-none px-1 pb-3 text-sm data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Collaborators
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="data-[state=active]:border-foreground data-[state=active]:text-foreground text-muted-foreground rounded-none px-1 pb-3 text-sm data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            {/* INFO TAB */}
            <TabsContent value="info" className="mt-0">
              {isBlockMode ? (
                <BlockInfoTab blockId={activeBlockId!} />
              ) : (
                <DocumentInfoTab />
              )}
            </TabsContent>

            {/* COLLABORATORS TAB */}
            <TabsContent value="collaborators" className="mt-0">
              {isBlockMode ? (
                <BlockCollaboratorsTab blockId={activeBlockId!} />
              ) : (
                <CollaboratorsTab documentId={activeDocumentId} />
              )}
            </TabsContent>

            {/* TIMELINE TAB */}
            <TabsContent value="timeline" className="mt-0">
              <TimelineTab onContentPreview={setPreviewContent} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </aside>
  )
}
