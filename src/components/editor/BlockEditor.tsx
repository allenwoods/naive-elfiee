import { useState } from 'react'
import { FileText, Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/app-store'
import type { Block } from '@/bindings'

const BlockCard = ({
  block,
  isActive,
  onSelect,
}: {
  block: Block
  isActive: boolean
  onSelect: (id: string) => void
}) => {
  const contents = block.contents as { markdown?: string }
  const preview = contents?.markdown?.slice(0, 120) || 'Empty block'
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 transition-colors',
        isActive ? 'border-accent bg-accent/5 shadow-sm' : 'border-border'
      )}
      onClick={() => onSelect(block.block_id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            {block.name}
          </h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {block.block_type}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {preview}
      </p>
    </div>
  )
}

export const BlockEditor = () => {
  const { currentFileId, selectedBlockId, getBlocks, selectBlock } =
    useAppStore()
  const blocks = currentFileId ? getBlocks(currentFileId) : []
  const [isSaving, setIsSaving] = useState(false)

  if (!currentFileId) {
    return (
      <main className="flex flex-1 items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 opacity-20" />
          <p>Open a file to start editing</p>
        </div>
      </main>
    )
  }

  return (
    <main className="h-full flex-1 overflow-auto bg-background p-8">
      <div className="mx-auto max-w-3xl space-y-6 pb-32">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Blocks</h1>
            <Badge variant="secondary" className="mt-2 text-xs font-medium">
              {blocks.length} blocks
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Block
            </Button>
            <Button
              className="bg-primary px-6 font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
              disabled={isSaving}
              onClick={() => setIsSaving(false)}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {blocks.map((block) => (
            <BlockCard
              key={block.block_id}
              block={block}
              isActive={selectedBlockId === block.block_id}
              onSelect={(id) => selectBlock(id)}
            />
          ))}

          {blocks.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-border py-20 text-center">
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

export default BlockEditor
