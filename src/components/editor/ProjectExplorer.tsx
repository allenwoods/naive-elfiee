import { Folder, FileText, Plus } from 'lucide-react'
import { useAppStore } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { Block } from '@/bindings'

export const ProjectExplorer = ({
  activeProjectId,
}: {
  activeProjectId?: string
}) => {
  const { currentFileId, getBlocks, selectBlock } = useAppStore()
  const blocks: Block[] = currentFileId ? getBlocks(currentFileId) : []

  return (
    <aside className="bg-secondary/50 border-border flex h-full w-[250px] flex-col border-r">
      {/* Header */}
      <div className="border-border border-b p-4">
        <p className="text-muted-foreground mb-1 text-xs">Project</p>
        <h2 className="text-foreground flex items-center gap-2 truncate text-sm font-semibold">
          <Folder className="text-accent h-4 w-4" />
          {currentFileId || 'No file opened'}
        </h2>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-2">
          {/* Blocks Section */}
          <div className="px-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Blocks
              </span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {blocks.map((block) => (
                <button
                  key={block.block_id}
                  className="hover:bg-card/50 text-foreground flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors"
                  onClick={() => selectBlock(block.block_id)}
                >
                  <FileText className="text-muted-foreground h-4 w-4" />
                  <span className="truncate text-sm">{block.name}</span>
                </button>
              ))}
              {blocks.length === 0 && (
                <div className="text-muted-foreground px-3 py-4 text-xs">
                  No blocks loaded. Open a file first.
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
