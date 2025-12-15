import { useState } from 'react'
import { Link } from 'react-router-dom'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/app-store'
import type { Block } from '@/bindings'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from 'sonner'

// --- Block Status Types ---
type BlockStatus = 'history' | 'working' | 'review'

interface BlockStatusConfig {
  status: BlockStatus
  actor: string
  avatarUrl?: string
}

// Block status will be derived from grants and events

// --- Collaborator Badge Component ---
interface CollaboratorBadgeProps {
  config: BlockStatusConfig
}

const CollaboratorBadge = ({ config }: CollaboratorBadgeProps) => {
  const { status, actor } = config

  // State A: History/Idle - Subtle, low opacity
  if (status === 'history') {
    return (
      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-50 transition-opacity hover:opacity-100">
        <div className="bg-muted-foreground/20 text-muted-foreground flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-medium">
          {actor.charAt(0)}
        </div>
        <span className="text-muted-foreground text-xs">{actor}</span>
      </div>
    )
  }

  // State B: Working/Active - Orange border with spinner
  if (status === 'working') {
    return (
      <div className="bg-accent-light absolute top-2 right-2 flex items-center gap-1.5 rounded-full px-2 py-1">
        <div className="bg-accent/20 text-accent flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-medium">
          {actor.charAt(0)}
        </div>
        <span className="text-accent text-xs font-medium">Writing...</span>
        <Loader2 className="text-accent h-3 w-3 animate-spin" />
      </div>
    )
  }

  // State C: Review Needed - Solid accent badge
  if (status === 'review') {
    return (
      <div className="bg-accent absolute top-2 right-2 rounded-full px-2.5 py-1">
        <span className="text-accent-foreground text-xs font-medium">
          Review Needed
        </span>
      </div>
    )
  }

  return null
}

// --- Components ---

interface BlockComponentProps {
  block: Block
  blockIndex: number
  isHovered: boolean
  isActive: boolean
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}

const CodeBlock = ({
  block,
  isActive,
}: {
  block: Block
  isActive: boolean
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsRunning(true)
    try {
      // TODO: Implement code execution via Tauri
      // For now, just show a placeholder
      setOutput('Code execution not yet implemented')
      toast.success('Code execution will be implemented via Tauri')
    } catch (error) {
      toast.error('Failed to execute code')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="border-border my-2 overflow-hidden rounded-lg border shadow-sm">
      {/* Code Header */}
      <div className="bg-secondary/50 border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs uppercase">
            {block.language || 'text'}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="hover:bg-accent hover:text-accent-foreground h-7 text-xs transition-colors"
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-1.5 h-3 w-3" />
              Run
            </>
          )}
        </Button>
      </div>

      {/* Code Content */}
      <div className="group relative">
        <SyntaxHighlighter
          language={block.language || 'text'}
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem' }}
          wrapLines={true}
        >
          {(() => {
            const contents = block.contents as {
              markdown?: string
              code?: string
            }
            return contents?.markdown || contents?.code || ''
          })()}
        </SyntaxHighlighter>
      </div>

      {/* Terminal Output (Runme-like) */}
      <AnimatePresence>
        {output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-border border-t bg-black"
          >
            <div className="p-4 font-mono text-sm">
              <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs select-none">
                <Terminal className="h-3 w-3" />
                <span>Terminal Output</span>
              </div>
              <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-green-400 md:text-sm">
                {output}
              </pre>

              {/* Mock File Reference Link */}
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="mb-1 text-xs text-gray-500">
                  Modified Files:
                </div>
                <button className="flex items-center gap-1.5 text-xs text-blue-400 transition-colors hover:text-blue-300 hover:underline">
                  <FileText className="h-3 w-3" />
                  src/utils.ts
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const TextBlock = ({
  block,
  isActive,
}: {
  block: Block
  isActive: boolean
}) => {
  const [isAgentRunning, setIsAgentRunning] = useState(false)
  const { runAgent } = useEditorStore()

  const handleRunAgent = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsAgentRunning(true)
    try {
      // TODO: Implement agent execution via Tauri
      toast.info('Agent execution will be implemented via Tauri')
      toast.success('Agent task started')
      setTimeout(() => setIsAgentRunning(false), 1500) // Mock delay
    } catch (error) {
      setIsAgentRunning(false)
    }
  }

  return (
    <div className="group relative">
      {block.type === 'h1' ? (
        <h1 className="text-foreground mb-4 text-2xl font-bold">
          {block.content}
        </h1>
      ) : (
        <div className="relative">
          <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap">
            {(() => {
              const contents = block.contents as {
                markdown?: string
                code?: string
              }
              return contents?.markdown || contents?.code || ''
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
                  className="bg-background border-accent/20 text-accent hover:bg-accent/5 h-8 text-xs shadow-sm"
                  onClick={handleRunAgent}
                  disabled={isAgentRunning}
                >
                  {isAgentRunning ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Agent Working...
                    </>
                  ) : (
                    <>
                      <Bot className="mr-1.5 h-3 w-3" />
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
  )
}

const BlockComponent = ({
  block,
  blockIndex,
  isHovered,
  isActive,
  onHover,
  onClick,
}: BlockComponentProps) => {
  const statusConfig = mockBlockStatuses[blockIndex]
  const hasAccentBorder =
    statusConfig?.status === 'working' || statusConfig?.status === 'review'

  return (
    <div
      className={cn(
        'group relative -mx-4 flex items-start gap-2 rounded-xl px-4 py-4 transition-all duration-200',
        isHovered && !isActive && 'bg-secondary/30',
        isActive && 'bg-accent/5 shadow-sm',
        hasAccentBorder && 'border-accent border',
        !hasAccentBorder &&
          isActive &&
          'border-l-accent border-accent/20 border-y border-r border-l-[4px]'
      )}
      onMouseEnter={() => onHover(block.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation()
        onClick(block.id)
      }}
    >
      {/* Collaborator Badge (Top-Right) */}
      {statusConfig && <CollaboratorBadge config={statusConfig} />}

      {/* Block Controls (Left Gutter) */}
      <div
        className={cn(
          'absolute -left-16 flex w-14 items-center justify-end gap-1 pt-1.5 opacity-0 transition-opacity',
          isHovered && 'opacity-100'
        )}
      >
        <button className="hover:bg-secondary text-muted-foreground hover:text-foreground cursor-grab rounded p-1 transition-colors">
          <GripVertical className="h-4 w-4" />
        </button>
        <button className="hover:bg-secondary text-muted-foreground hover:text-foreground rounded p-1 transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Block Content */}
      <div className="min-w-0 flex-1 pt-6">
        {block.block_type === 'code' ? (
          <CodeBlock block={block} isActive={isActive} />
        ) : (
          <TextBlock block={block} isActive={isActive} />
        )}
      </div>
    </div>
  )
}

// --- Main Component ---

export const BlockEditor = () => {
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null)
  const { currentFileId, selectedBlockId, getBlocks, selectBlock } =
    useAppStore()

  // Get blocks for current file
  const currentBlocks = currentFileId ? getBlocks(currentFileId) : []

  // Click on background to deselect block
  const handleBackgroundClick = () => {
    selectBlock(null)
  }

  if (!currentFileId) {
    return (
      <main className="bg-background text-muted-foreground flex flex-1 items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 opacity-20" />
          <p>Open a file to start editing</p>
        </div>
      </main>
    )
  }

  return (
    <main
      className="bg-background h-full flex-1 overflow-auto p-8"
      onClick={handleBackgroundClick}
    >
      {/* Editor Container */}
      <div className="mx-auto max-w-3xl pb-32">
        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-3xl font-bold">Blocks</h1>
            <Badge variant="secondary" className="mt-2 text-xs font-medium">
              {currentBlocks.length} blocks
            </Badge>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 font-semibold shadow-md">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </motion.div>
        </div>

        {/* Blocks List */}
        <div className="min-h-[500px] space-y-2">
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
            <div className="border-border rounded-xl border-2 border-dashed py-20 text-center">
              <p className="text-muted-foreground">
                Empty document. Start typing...
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
