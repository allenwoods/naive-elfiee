import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MoreHorizontal, Copy, Trash2, Pencil, Bot } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type ProjectStatus = "synced" | "conflict" | "editing" | "archived";

export interface Collaborator {
  id: string;
  name: string;
  avatar?: string;
  isAgent?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  path: string;
  status: ProjectStatus;
  lastEdited: string;
  collaborators?: Collaborator[];
}

interface ProjectCardProps {
  project: Project;
  index: number;
  onRename: (id: string, newName: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isHighlighted?: boolean;
}

const getStatusConfig = (status: ProjectStatus) => {
  switch (status) {
    case "synced":
      return {
        dot: "bg-green-500",
        label: "Synced",
        tooltip: "All systems normal",
      };
    case "conflict":
      return {
        dot: "bg-red-500",
        label: "Conflict",
        tooltip: "Merge conflict detected",
      };
    case "editing":
      return {
        dot: "bg-yellow-500",
        label: "Editing",
        tooltip: "Unsaved local changes",
      };
  }
};

export const ProjectCard = ({
  project,
  index,
  onRename,
  onDuplicate,
  onDelete,
  isHighlighted = false,
}: ProjectCardProps) => {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [isHovered, setIsHovered] = useState(false);

  const statusConfig = getStatusConfig(project.status);
  const hasCollaborators = project.collaborators && project.collaborators.length > 0;

  const handleCardClick = () => {
    navigate(`/editor/${project.id}`);
  };

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== project.name) {
      onRename(project.id, renameValue.trim());
    }
    setShowRenameDialog(false);
  };

  const handleMenuClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  // Use collaborators from project or empty array
  const collaborators: Collaborator[] = project.collaborators || [];

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.08 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={isHighlighted ? "animate-highlight-fade" : ""}
      >
        <div
          onClick={handleCardClick}
          className="bg-card rounded-xl border p-5 h-52 flex flex-col transition-all duration-200 relative hover:border-primary hover:shadow-lg cursor-pointer border-border"
        >
          {/* Top Row: Status + Context Menu */}
          <div className="flex items-center justify-between mb-3">
            {/* Status Indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.dot}`} />
                  <span className="text-xs font-medium text-muted-foreground">
                    {statusConfig.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{statusConfig.tooltip}</p>
              </TooltipContent>
            </Tooltip>

            {/* Context Menu (Three Dots) - Only visible on hover */}
            <div
              className={`transition-opacity duration-200 ${
                isHovered ? "opacity-100" : "opacity-0"
              }`}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"
                  >
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border z-50">
                  <DropdownMenuItem
                    onClick={(e) =>
                      handleMenuClick(e as unknown as React.MouseEvent, () => {
                        setRenameValue(project.name);
                        setShowRenameDialog(true);
                      })
                    }
                    className="cursor-pointer"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) =>
                      handleMenuClick(e as unknown as React.MouseEvent, () =>
                        onDuplicate(project.id)
                      )
                    }
                    className="cursor-pointer"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) =>
                      handleMenuClick(e as unknown as React.MouseEvent, () =>
                        setShowDeleteDialog(true)
                      )
                    }
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Title */}
          <div className="mb-2">
            <h3 className="font-semibold text-lg text-foreground">{project.name}</h3>
          </div>

          {/* Description - 2 line truncation */}
          <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{project.description}</p>

          {/* Footer: Path + Last Edited + Avatars */}
          <div className="pt-3 border-t border-border mt-auto">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground min-w-0 flex-1">
                <span className="truncate">{project.path}</span>
                <span>{project.lastEdited}</span>
              </div>

              {/* Collaborator Avatars (View Only) */}
              {hasCollaborators && (
                <div className="flex -space-x-2 ml-2">
                  {collaborators.slice(0, 3).map((collab) => (
                    <Tooltip key={collab.id}>
                      <TooltipTrigger asChild>
                        <Avatar className="w-6 h-6 border-2 border-card">
                          {collab.isAgent ? (
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              <Bot className="w-3 h-3" />
                            </AvatarFallback>
                          ) : collab.avatar ? (
                            <AvatarImage src={collab.avatar} />
                          ) : (
                            <AvatarFallback className="bg-secondary text-xs">
                              {collab.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {collab.name}
                          {collab.isAgent ? " (Agent)" : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{project.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(project.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Rename Dialog */}
        <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rename Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Project Alias</label>
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Enter project name"
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  This sets the display alias. The original folder name is preserved.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowRenameDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleRename} disabled={!renameValue.trim()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </motion.div>
    </TooltipProvider>
  );
};
