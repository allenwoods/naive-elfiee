import { Folder, ChevronRight } from 'lucide-react'

interface LocationBreadcrumbProps {
  projectName?: string
}

export const LocationBreadcrumb = ({
  projectName,
}: LocationBreadcrumbProps) => {
  const sanitizedName = projectName
    ? projectName.toLowerCase().replace(/\s+/g, '-')
    : ''

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Location</label>
      <div className="bg-muted/50 border-border flex items-center gap-1 rounded-md border px-3 py-2.5">
        <Folder className="text-muted-foreground h-4 w-4 flex-shrink-0" />
        <span className="text-muted-foreground text-sm">~/Projects/</span>
        <ChevronRight className="text-muted-foreground h-3 w-3 flex-shrink-0" />
        <span className="text-foreground truncate text-sm font-medium">
          {sanitizedName || 'your-project-name'}
        </span>
      </div>
    </div>
  )
}
