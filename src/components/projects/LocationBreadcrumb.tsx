import { Folder, ChevronRight } from "lucide-react";

interface LocationBreadcrumbProps {
  projectName?: string;
}

export const LocationBreadcrumb = ({ projectName }: LocationBreadcrumbProps) => {
  const sanitizedName = projectName ? projectName.toLowerCase().replace(/\s+/g, "-") : "";

  return (
    <div>
      <label className="text-sm font-medium mb-2 block">Location</label>
      <div className="flex items-center gap-1 px-3 py-2.5 bg-muted/50 border border-border rounded-md">
        <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground">~/Projects/</span>
        <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">
          {sanitizedName || "your-project-name"}
        </span>
      </div>
    </div>
  );
};
