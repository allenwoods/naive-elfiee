import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MoreHorizontal, Copy, Trash2, Pencil } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export type ProjectStatus = 'synced' | 'conflict' | 'editing' | 'archived'

export interface Collaborator {
  id: string
  name: string
  avatar?: string
  isAgent?: boolean
}

export interface Project {
  id: string
  name: string
  path: string
  status: ProjectStatus
  lastEdited: string
  collaborators?: Collaborator[]
}

interface ProjectCardProps {
  project: Project
  index: number
  onRename: (id: string, newName: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  isHighlighted?: boolean
}

const getStatusConfig = (status: ProjectStatus) => {
  switch (status) {
    case 'synced':
      return {
        dot: 'bg-green-500',
        label: 'Synced',
        tooltip: 'All systems normal',
      }
    case 'conflict':
      return {
        dot: 'bg-red-500',
        label: 'Conflict',
        tooltip: 'Merge conflict detected',
      }
    case 'editing':
      return {
        dot: 'bg-yellow-500',
        label: 'Editing',
        tooltip: 'Unsaved local changes',
      }
    case 'archived':
      return {
        dot: 'bg-gray-500',
        label: 'Archived',
        tooltip: 'This project is archived',
      }
  }
}

export const ProjectCard = ({
  project,
  index,
  onRename,
  onDuplicate,
  onDelete,
  isHighlighted = false,
}: ProjectCardProps) => {
  const navigate = useNavigate()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameValue, setRenameValue] = useState(project.name)
  const [isHovered, setIsHovered] = useState(false)

  const statusConfig = getStatusConfig(project.status)

  const handleCardClick = () => {
    navigate(`/editor/${project.id}`)
  }

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== project.name) {
      onRename(project.id, renameValue.trim())
    }
    setShowRenameDialog(false)
  }

  const handleMenuClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    action()
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.08 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={isHighlighted ? 'animate-highlight-fade' : ''}
      >
        <div
          onClick={handleCardClick}
          className="relative flex h-52 cursor-pointer flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary hover:shadow-lg"
        >
          {/* Top Row: Status + Context Menu */}
          <div className="mb-3 flex items-center justify-between">
            {/* Status Indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${statusConfig.dot}`}
                  />
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
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary"
                  >
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="z-50 border-border bg-card"
                >
                  <DropdownMenuItem
                    onClick={(e) =>
                      handleMenuClick(e as unknown as React.MouseEvent, () => {
                        setRenameValue(project.name)
                        setShowRenameDialog(true)
                      })
                    }
                    className="cursor-pointer"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
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
                    <Copy className="mr-2 h-4 w-4" />
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
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Title */}
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-foreground">
              {project.name}
            </h3>
          </div>

          {/* Footer: Path + Last Edited + Avatars */}
          <div className="mt-auto border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
                <span className="truncate">{project.path}</span>
                <span>{project.lastEdited}</span>
              </div>

              {/* Collaborator Avatars (View Only) */}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{project.name}"? This action
                cannot be undone.
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
                <label className="mb-2 block text-sm font-medium">
                  Project Alias
                </label>
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Enter project name"
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  This sets the display alias. The original folder name is
                  preserved.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setShowRenameDialog(false)}
              >
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
  )
}
