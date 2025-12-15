import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  useEditorStore,
  Block,
  Collaborator,
  AgentConfig,
  TimelineEvent as TimelineEventType,
} from "@/lib/mockStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// --- Types & Schemas ---

const agentConfigSchema = z.object({
  model: z.string(),
  apiKey: z.string().min(1, "API Key is required"),
  systemPrompt: z.string().optional(),
});

type AgentConfigForm = z.infer<typeof agentConfigSchema>;

// --- Components ---

const TimelineEvent = ({ event, index }: { event: TimelineEventType; index: number }) => {
  // Use Pencil as default icon (TimelineEvent no longer has icon property)
  const EventIcon = Pencil;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative pl-7 pb-6 last:pb-0"
    >
      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border last:hidden" />
      <div className="absolute left-0 top-0.5 w-[22px] h-[22px] rounded-full bg-secondary flex items-center justify-center border border-border">
        <EventIcon className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{event.actor}</span>
          <span>•</span>
          <span>{event.timestamp}</span>
        </div>
        <p className="text-sm text-foreground">{event.description}</p>
      </div>
    </motion.div>
  );
};

const AgentConfigTab = ({ agentId }: { agentId: string }) => {
  const { agentConfigs, updateAgentConfig } = useEditorStore();
  const config = agentConfigs[agentId] || { model: "gpt-4", apiKey: "", systemPrompt: "" };

  const form = useForm<AgentConfigForm>({
    resolver: zodResolver(agentConfigSchema),
    defaultValues: {
      model: config.model,
      apiKey: config.apiKey,
      systemPrompt: config.systemPrompt,
    },
  });

  const onSubmit = (data: AgentConfigForm) => {
    updateAgentConfig(agentId, { model: data.model, apiKey: data.apiKey, systemPrompt: data.systemPrompt || "" });
    toast.success("Agent configuration saved");
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
      <div className="space-y-2">
        <Label>Model</Label>
        <Select defaultValue={config.model} onValueChange={(v) => form.setValue("model", v)}>
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
        <Input type="password" placeholder="sk-..." {...form.register("apiKey")} />
        {form.formState.errors.apiKey && (
          <p className="text-xs text-destructive">{form.formState.errors.apiKey.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>System Prompt</Label>
        <Textarea
          rows={5}
          placeholder="You are a helpful assistant..."
          {...form.register("systemPrompt")}
        />
      </div>

      <Button type="submit" className="w-full">
        Save Configuration
      </Button>
    </form>
  );
};

const PermissionsTab = ({ documentId }: { documentId: string }) => {
  const { collaborators, addCollaborator } = useEditorStore();
  const docCollaborators = collaborators[documentId] || [];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {docCollaborators.map((collab) => (
          <div
            key={collab.id}
            className="flex items-start justify-between p-3 bg-secondary/30 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                {collab.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{collab.name}</p>
                <Badge variant="outline" className="text-[10px] h-5">
                  {collab.role}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 max-w-[120px] justify-end">
              {collab.permissions.map((p) => (
                <span
                  key={p}
                  className="text-[10px] bg-background border px-1.5 py-0.5 rounded text-muted-foreground"
                >
                  {p.split(".")[1]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={() => toast.info("Mock: Add Collaborator Dialog")}
      >
        <UserPlus className="w-4 h-4 mr-2" />
        Add Collaborator
      </Button>
    </div>
  );
};

// --- Main Views ---

const DocumentDetailsView = ({ documentId }: { documentId: string }) => {
  return (
    <Tabs defaultValue="info" className="flex-1 flex flex-col">
      <div className="px-4 pt-4 border-b border-border">
        <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-4">
          <TabsTrigger
            value="info"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-1 pb-3"
          >
            Info
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-1 pb-3"
          >
            Permissions
          </TabsTrigger>
          <TabsTrigger
            value="agent"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-1 pb-3"
          >
            Agent
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <TabsContent value="info" className="mt-0 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Owner</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] text-accent">
                  Y
                </div>
                <span className="text-sm">Yao</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">Dec 05, 2025</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="secondary">Draft</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Timeline</h3>
            <div className="pt-2">
              <TimelineEvent
                index={0}
                event={{ id: "e1", actor: "Yao", actorType: "human", action: "Created", timestamp: "10:00 AM", description: "Created document" }}
              />
              <TimelineEvent
                index={1}
                event={{
                  id: "e2",
                  actor: "Claude",
                  actorType: "architect",
                  action: "Edited",
                  timestamp: "10:05 AM",
                  description: "Added initial blocks",
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
            <h3 className="text-sm font-medium mb-2">Default Agent</h3>
            <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg flex items-center gap-3">
              <Bot className="w-8 h-8 text-accent" />
              <div>
                <p className="text-sm font-medium">Claude-architect</p>
                <p className="text-xs text-muted-foreground">Configured for this doc</p>
              </div>
            </div>
          </div>
          <AgentConfigTab agentId="a1" />
        </TabsContent>
      </div>
    </Tabs>
  );
};

const BlockDetailsView = ({ block }: { block: Block }) => {
  return (
    <Tabs defaultValue="actions" className="flex-1 flex flex-col">
      <div className="px-4 pt-4 border-b border-border">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Block Details</h2>
          <p className="text-xs text-muted-foreground truncate mt-1">{block.id}</p>
        </div>
        <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-4">
          <TabsTrigger
            value="actions"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-1 pb-3"
          >
            Actions
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-1 pb-3"
          >
            History
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <TabsContent value="actions" className="mt-0 space-y-4">
          <div className="p-4 bg-secondary/30 rounded-xl space-y-3">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-accent" />
              <div>
                <p className="text-sm font-medium">Ask Agent</p>
                <p className="text-xs text-muted-foreground">Delegate this block</p>
              </div>
            </div>
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              Run Agent on Block
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <TimelineEvent
            index={0}
            event={{ id: "e3", actor: "Yao", actorType: "human", action: "Edited", timestamp: "Today", description: "Modified content" }}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
};

// --- Main Component ---

export const EditorSidebar = () => {
  const { activeBlockId, activeDocumentId, blocks } = useEditorStore();

  // Find the active block object
  const activeBlock =
    activeDocumentId && activeBlockId
      ? blocks[activeDocumentId]?.find((b) => b.id === activeBlockId)
      : null;

  if (!activeDocumentId) {
    return (
      <aside className="w-[320px] bg-card border-l border-border flex items-center justify-center text-muted-foreground">
        <p>No document selected</p>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] bg-card border-l border-border flex flex-col">
      {activeBlock ? (
        <BlockDetailsView block={activeBlock} />
      ) : (
        <DocumentDetailsView documentId={activeDocumentId} />
      )}
    </aside>
  );
};
