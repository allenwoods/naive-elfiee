import { useState, useEffect } from "react";
import { History, Shield, Bot, Clock, Code, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/app-store";
import type { Block, Event, Editor, Grant } from "@/bindings";

interface AgentContextProps {
  selectedBlock: Block | null;
  fileId: string | null;
}

const getActionColor = (action: string) => {
  switch (action) {
    case "EDITED":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "CREATED":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "DELETED":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-secondary text-muted-foreground";
  }
};

const getBlockTypeConfig = (blockType: string | undefined) => {
  switch (blockType) {
    case "code":
      return { label: "CODE", icon: Code, color: "bg-accent/20 text-accent border-accent/30" };
    case "markdown":
      return { label: "MARKDOWN", icon: Type, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
    default:
      return { label: "BLOCK", icon: Type, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  }
};

const formatTimestamp = (timestamp: Record<string, number>): string => {
  // Simple timestamp formatting - can be improved
  const values = Object.values(timestamp);
  if (values.length === 0) return "00:00";
  const max = Math.max(...values);
  const hours = Math.floor(max / 3600) % 24;
  const minutes = Math.floor((max % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseEventAction = (attribute: string): string => {
  const parts = attribute.split('/');
  if (parts.length < 2) return attribute;
  const capId = parts[1];
  if (capId.includes('write')) return 'EDITED';
  if (capId.includes('create')) return 'CREATED';
  if (capId.includes('delete')) return 'DELETED';
  return capId.toUpperCase();
};

export const AgentContext = ({ selectedBlock, fileId }: AgentContextProps) => {
  const [activeTab, setActiveTab] = useState("history");
  const { getEvents, getEditors, getGrants, getBlockGrants, grantCapability, revokeCapability } = useAppStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);

  useEffect(() => {
    if (fileId) {
      const fileEvents = getEvents(fileId);
      const blockEvents = selectedBlock
        ? fileEvents.filter(e => e.entity === selectedBlock.block_id)
        : fileEvents;
      setEvents(blockEvents.slice(-10).reverse()); // Last 10 events, newest first

      const fileEditors = getEditors(fileId);
      setEditors(fileEditors);

      if (selectedBlock) {
        const blockGrants = getBlockGrants(fileId, selectedBlock.block_id);
        setGrants(blockGrants);
      } else {
        const allGrants = getGrants(fileId);
        setGrants(allGrants);
      }
    }
  }, [fileId, selectedBlock, getEvents, getEditors, getGrants, getBlockGrants]);

  const blockTypeConfig = getBlockTypeConfig(selectedBlock?.block_type);
  const BlockIcon = blockTypeConfig.icon;

  const handleTogglePermission = async (editorId: string, capability: string, enabled: boolean) => {
    if (!fileId || !selectedBlock) return;
    
    if (enabled) {
      await revokeCapability(fileId, editorId, capability, selectedBlock.block_id);
    } else {
      await grantCapability(fileId, editorId, capability, selectedBlock.block_id);
    }
  };

  return (
    <aside className="w-[320px] bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Block Details</h2>
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${blockTypeConfig.color}`}>
            <BlockIcon className="w-3 h-3 mr-1" />
            {blockTypeConfig.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 truncate">
          {selectedBlock ? selectedBlock.name : "Select a block"}
        </p>
      </div>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto">
          <TabsTrigger
            value="history"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-4 py-3 text-sm"
          >
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-4 py-3 text-sm"
          >
            <Shield className="w-4 h-4 mr-2" />
            Permissions
          </TabsTrigger>
          <TabsTrigger
            value="agent"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-4 py-3 text-sm"
          >
            <Bot className="w-4 h-4 mr-2" />
            Editors
          </TabsTrigger>
        </TabsList>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 overflow-auto p-4 mt-0">
          <div className="space-y-1">
            {events.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">
                No events yet
              </div>
            ) : (
              events.map((event, index) => {
                const [editorId] = event.attribute.split('/');
                const editor = editors.find(e => e.editor_id === editorId);
                const action = parseEventAction(event.attribute);
                return (
                  <motion.div
                    key={event.event_id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative pl-6 pb-4 last:pb-0"
                  >
                    {/* Timeline line */}
                    {index < events.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                    )}
                    
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1 w-[22px] h-[22px] rounded-full bg-secondary border-2 border-border flex items-center justify-center">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {editor?.name.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>

                    {/* Event content */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(event.timestamp)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-5 ${getActionColor(action)}`}
                        >
                          {action}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {editor?.name || editorId}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="flex-1 overflow-auto p-4 mt-0">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Collaborator Permissions
            </h3>
            
            <div className="space-y-4">
              {editors.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-8">
                  No editors available
                </div>
              ) : (
                editors.map((editor) => {
                  const editorGrants = grants.filter(g => g.editor_id === editor.editor_id);
                  const capabilities = ['markdown.read', 'markdown.write', 'core.delete'];
                  
                  return (
                    <div key={editor.editor_id} className="p-4 bg-secondary/30 rounded-xl space-y-3">
                      {/* User Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                          <span className="text-sm font-bold text-accent">
                            {editor.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-foreground">{editor.name}</span>
                        </div>
                      </div>
                      
                      {/* Permission Pills */}
                      <div className="flex flex-wrap gap-2">
                        {capabilities.map((cap) => {
                          const hasPermission = editorGrants.some(g => g.cap_id === cap);
                          return (
                            <button
                              key={cap}
                              onClick={() => handleTogglePermission(editor.editor_id, cap, hasPermission)}
                              className={cn(
                                "px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer",
                                hasPermission
                                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                                  : "bg-background border border-border text-muted-foreground hover:border-accent/50"
                              )}
                            >
                              {cap.split('.').pop()?.toUpperCase() || cap}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        {/* Editors Tab */}
        <TabsContent value="agent" className="flex-1 overflow-auto p-4 mt-0">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Editors
            </h3>
            
            <div className="space-y-3">
              {editors.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-8">
                  No editors available
                </div>
              ) : (
                editors.map((editor) => (
                  <motion.div
                    key={editor.editor_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-secondary/30 rounded-xl space-y-3 border border-transparent hover:border-accent/30 transition-colors"
                  >
                    {/* Editor Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                        <span className="text-sm font-bold text-accent">
                          {editor.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{editor.name}</p>
                        <p className="text-xs text-muted-foreground">Editor ID: {editor.editor_id}</p>
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
  );
};
