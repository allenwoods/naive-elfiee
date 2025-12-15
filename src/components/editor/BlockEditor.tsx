import { useState } from "react";
import { Link } from "react-router-dom";
import {
  GripVertical,
  Plus,
  Save,
  ChevronRight,
  Play,
  Bot,
  Loader2,
  FileText,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/app-store";
import type { Block } from "@/bindings";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";

// --- Block Status Types ---
type BlockStatus = "history" | "working" | "review";

interface BlockStatusConfig {
  status: BlockStatus;
  actor: string;
  avatarUrl?: string;
}

// Block status will be derived from grants and events

// --- Collaborator Badge Component ---
interface CollaboratorBadgeProps {
  config: BlockStatusConfig;
}

const CollaboratorBadge = ({ config }: CollaboratorBadgeProps) => {
  const { status, actor } = config;

  // State A: History/Idle - Subtle, low opacity
  if (status === "history") {
    return (
      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
        <div className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[8px] font-medium text-muted-foreground">
          {actor.charAt(0)}
        </div>
        <span className="text-xs text-muted-foreground">{actor}</span>
      </div>
    );
  }

  // State B: Working/Active - Orange border with spinner
  if (status === "working") {
    return (
      <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent-light">
        <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center text-[8px] font-medium text-accent">
          {actor.charAt(0)}
        </div>
        <span className="text-xs font-medium text-accent">Writing...</span>
        <Loader2 className="w-3 h-3 text-accent animate-spin" />
      </div>
    );
  }

  // State C: Review Needed - Solid accent badge
  if (status === "review") {
    return (
      <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-accent">
        <span className="text-xs font-medium text-accent-foreground">Review Needed</span>
      </div>
    );
  }

  return null;
};

// --- Components ---

interface BlockComponentProps {
  block: Block;
  blockIndex: number;
  isHovered: boolean;
  isActive: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}

const CodeBlock = ({ block, isActive }: { block: Block; isActive: boolean }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRunning(true);
    try {
      // TODO: Implement code execution via Tauri
      // For now, just show a placeholder
      setOutput("Code execution not yet implemented");
      toast.success("Code execution will be implemented via Tauri");
    } catch (error) {
      toast.error("Failed to execute code");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="my-2 border border-border rounded-lg overflow-hidden shadow-sm">
      {/* Code Header */}
      <div className="flex items-center justify-between bg-secondary/50 px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono uppercase">
            {block.language || "text"}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1.5" />
              Run
            </>
          )}
        </Button>
      </div>

      {/* Code Content */}
      <div className="relative group">
        <SyntaxHighlighter
          language={block.language || "text"}
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: "1rem", fontSize: "0.875rem" }}
          wrapLines={true}
        >
          {(() => {
            const contents = block.contents as { markdown?: string; code?: string };
            return contents?.markdown || contents?.code || "";
          })()}
        </SyntaxHighlighter>
      </div>

      {/* Terminal Output (Runme-like) */}
      <AnimatePresence>
        {output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border bg-black"
          >
            <div className="p-4 font-mono text-sm">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2 select-none">
                <Terminal className="w-3 h-3" />
                <span>Terminal Output</span>
              </div>
              <pre className="whitespace-pre-wrap text-green-400 font-mono text-xs md:text-sm leading-relaxed">
                {output}
              </pre>

              {/* Mock File Reference Link */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="text-xs text-gray-500 mb-1">Modified Files:</div>
                <button className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors">
                  <FileText className="w-3 h-3" />
                  src/utils.ts
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TextBlock = ({ block, isActive }: { block: Block; isActive: boolean }) => {
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const { runAgent } = useEditorStore();

  const handleRunAgent = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAgentRunning(true);
    try {
      // TODO: Implement agent execution via Tauri
      toast.info("Agent execution will be implemented via Tauri");
      toast.success("Agent task started");
      setTimeout(() => setIsAgentRunning(false), 1500); // Mock delay
    } catch (error) {
      setIsAgentRunning(false);
    }
  };

  return (
    <div className="relative group">
      {block.type === "h1" ? (
        <h1 className="text-2xl font-bold text-foreground mb-4">{block.content}</h1>
      ) : (
        <div className="relative">
          <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
            {(() => {
            const contents = block.contents as { markdown?: string; code?: string };
            return contents?.markdown || contents?.code || "";
          })()}
          </p>

          {/* Agent Action (Visible when active) */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute -bottom-10 left-0 z-10"
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs bg-background shadow-sm border-accent/20 text-accent hover:bg-accent/5"
                  onClick={handleRunAgent}
                  disabled={isAgentRunning}
                >
                  {isAgentRunning ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      Agent Working...
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 mr-1.5" />
                      Ask Agent to Edit
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

const BlockComponent = ({ block, blockIndex, isHovered, isActive, onHover, onClick }: BlockComponentProps) => {
  const statusConfig = mockBlockStatuses[blockIndex];
  const hasAccentBorder = statusConfig?.status === "working" || statusConfig?.status === "review";

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2 py-4 px-4 -mx-4 rounded-xl transition-all duration-200",
        isHovered && !isActive && "bg-secondary/30",
        isActive && "bg-accent/5 shadow-sm",
        hasAccentBorder && "border border-accent",
        !hasAccentBorder && isActive && "border-l-[4px] border-l-accent border-y border-r border-accent/20"
      )}
      onMouseEnter={() => onHover(block.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(block.id);
      }}
    >
      {/* Collaborator Badge (Top-Right) */}
      {statusConfig && <CollaboratorBadge config={statusConfig} />}

      {/* Block Controls (Left Gutter) */}
      <div
        className={cn(
          "flex items-center gap-1 pt-1.5 opacity-0 transition-opacity absolute -left-16 w-14 justify-end",
          isHovered && "opacity-100"
        )}
      >
        <button className="p-1 hover:bg-secondary rounded cursor-grab text-muted-foreground hover:text-foreground transition-colors">
          <GripVertical className="w-4 h-4" />
        </button>
        <button className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Block Content */}
      <div className="flex-1 min-w-0 pt-6">
        {block.block_type === "code" ? (
          <CodeBlock block={block} isActive={isActive} />
        ) : (
          <TextBlock block={block} isActive={isActive} />
        )}
      </div>
    </div>
  );
};

// --- Main Component ---

export const BlockEditor = () => {
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const { currentFileId, selectedBlockId, getBlocks, selectBlock } = useAppStore();

  // Get blocks for current file
  const currentBlocks = currentFileId ? getBlocks(currentFileId) : [];

  // Click on background to deselect block
  const handleBackgroundClick = () => {
    selectBlock(null);
  };

  if (!currentFileId) {
    return (
      <main className="flex-1 bg-background flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>Open a file to start editing</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-background p-8 overflow-auto h-full" onClick={handleBackgroundClick}>
      {/* Editor Container */}
      <div className="max-w-3xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Blocks
            </h1>
            <Badge variant="secondary" className="text-xs font-medium mt-2">
              {currentBlocks.length} blocks
            </Badge>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-md">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </motion.div>
        </div>

        {/* Blocks List */}
        <div className="space-y-2 min-h-[500px]">
          {currentBlocks.map((block, index) => (
            <BlockComponent
              key={block.block_id}
              block={block}
              blockIndex={index}
              isHovered={hoveredBlock === block.block_id}
              isActive={selectedBlockId === block.block_id}
              onHover={setHoveredBlock}
              onClick={selectBlock}
            />
          ))}

          {/* Empty State / New Block Placeholder */}
          {currentBlocks.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
              <p className="text-muted-foreground">Empty document. Start typing...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
