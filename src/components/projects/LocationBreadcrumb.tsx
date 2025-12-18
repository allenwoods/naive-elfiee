import { Folder, ChevronRight, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LocationBreadcrumbProps {
  projectName?: string
  selectedPath?: string | null
  onSelectPath?: () => void
}

export const LocationBreadcrumb = ({
  projectName,
  selectedPath,
  onSelectPath,
}: LocationBreadcrumbProps) => {
  const sanitizedName = projectName
    ? projectName.toLowerCase().replace(/\s+/g, '-')
    : ''

  // Extract directory and filename from selected path
  const displayPath = selectedPath
    ? selectedPath
    : `~/Projects/${sanitizedName || 'your-project-name'}.elf`

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Location</label>
      <div className="relative flex items-center gap-1 rounded-md border border-border bg-muted/50 px-3 py-2.5">
        <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {displayPath}
        </span>
        {onSelectPath && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSelectPath}
            className="h-7 gap-1.5 px-2"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="text-xs">Choose</span>
          </Button>
        )}
      </div>
    </div>
  )
}
