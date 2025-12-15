import { useState, useRef } from "react";
import { X, Upload, Search, Github, FolderOpen, Clock, File, FolderUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ImportRepositoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (name: string, source: string) => void;
}

type TabType = "local" | "agentour" | "github";

// Mock Agentour projects
const mockAgentourProjects = [
  { id: "ag-1", name: "elfiee-backend", owner: "elfiee-team", updatedAt: "2 hours ago" },
  { id: "ag-2", name: "payment-service", owner: "elfiee-team", updatedAt: "1 day ago" },
  { id: "ag-3", name: "user-auth", owner: "elfiee-team", updatedAt: "3 days ago" },
  { id: "ag-4", name: "notification-hub", owner: "ops-team", updatedAt: "1 week ago" },
];

export const ImportRepositoryModal = ({ open, onOpenChange, onImport }: ImportRepositoryModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("local");
  const [selectedAgentourProject, setSelectedAgentourProject] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubBranch, setGithubBranch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleImport = () => {
    if (activeTab === "agentour" && selectedAgentourProject) {
      const project = mockAgentourProjects.find((p) => p.id === selectedAgentourProject);
      if (project) {
        onImport(project.name, "Agentour");
        onOpenChange(false);
        resetState();
      }
    } else if (activeTab === "github" && githubUrl) {
      const repoName = githubUrl.split("/").pop()?.replace(".git", "") || "github-repo";
      onImport(repoName, "GitHub");
      onOpenChange(false);
      resetState();
    } else if (activeTab === "local") {
      onImport("local-folder", "Local");
      onOpenChange(false);
      resetState();
    }
  };

  const resetState = () => {
    setSelectedAgentourProject(null);
    setGithubUrl("");
    setGithubBranch("");
    setSearchQuery("");
    setActiveTab("local");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const name = files[0].name;
      onImport(name, "Local File");
      onOpenChange(false);
      resetState();
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Get the folder name from the first file's path
      const folderName = files[0].webkitRelativePath.split("/")[0];
      onImport(folderName, "Local Folder");
      onOpenChange(false);
      resetState();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const item = items[0];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry?.();
        const name = entry?.name || "dropped-item";
        onImport(name, entry?.isDirectory ? "Local Folder" : "Local File");
        onOpenChange(false);
        resetState();
      }
    }
  };

  const filteredProjects = mockAgentourProjects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canImport =
    (activeTab === "agentour" && selectedAgentourProject) ||
    (activeTab === "github" && githubUrl.trim()) ||
    activeTab === "local";

  const tabs: { id: TabType; label: string; disabled?: boolean }[] = [
    { id: "local", label: "Local" },
    { id: "agentour", label: "Agentour", disabled: true },
    { id: "github", label: "GitHub", disabled: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-2xl w-[520px] max-w-[95vw] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Import Repository</h2>
          <button
            onClick={() => {
              onOpenChange(false);
              resetState();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="px-6 pt-4 border-b border-border">
          <div className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={cn(
                  "pb-3 text-sm font-medium transition-colors relative flex items-center gap-1.5",
                  tab.disabled
                    ? "text-gray-300 cursor-not-allowed"
                    : activeTab === tab.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.disabled && (
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
                    Coming Soon
                  </span>
                )}
                {activeTab === tab.id && !tab.disabled && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 min-h-[280px]">
          {/* Local Tab */}
          {activeTab === "local" && (
            <div className="h-full flex flex-col items-center justify-center">
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg h-40 w-full flex flex-col items-center justify-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                )}
              >
                <FolderOpen className="w-10 h-10 mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  Drag files or folders here
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Or use the buttons below to browse
                </p>
              </div>

              {/* Upload Buttons */}
              <div className="flex gap-3 mt-4 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <File className="w-4 h-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderUp className="w-4 h-4 mr-2" />
                  Upload Folder
                </Button>
              </div>

              {/* Hidden File Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                onChange={handleFolderSelect}
                {...({ webkitdirectory: "true", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </div>
          )}

          {/* Agentour Tab */}
          {activeTab === "agentour" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-border focus:border-foreground focus:ring-0"
                />
              </div>

              {/* Project List */}
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => setSelectedAgentourProject(project.id)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border",
                      selectedAgentourProject === project.id
                        ? "bg-orange-50 border-orange-200"
                        : "border-transparent hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.owner}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 ml-2">
                      <Clock className="w-3 h-3" />
                      <span>{project.updatedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GitHub Tab */}
          {activeTab === "github" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Github className="w-5 h-5" />
                <span className="text-sm">Connect to a GitHub repository</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Repository URL
                  </label>
                  <Input
                    placeholder="https://github.com/owner/repo"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="border-border focus:border-foreground focus:ring-0"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Branch Name <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <Input
                    placeholder="main"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    className="border-border focus:border-foreground focus:ring-0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              resetState();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!canImport}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
        </div>
      </div>
    </div>
  );
};