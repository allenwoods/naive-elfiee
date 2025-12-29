import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { LocationBreadcrumb } from './LocationBreadcrumb'
import { cn } from '@/lib/utils'
import { save } from '@tauri-apps/plugin-dialog'

interface CreateProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (project: { name: string; path: string }) => void
  existingNames: string[]
}

export const CreateProjectModal = ({
  open,
  onOpenChange,
  onCreate,
  existingNames,
}: CreateProjectModalProps) => {
  const [projectName, setProjectName] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setProjectName('')
      setSelectedPath(null)
      setIsCreating(false)
      setNameError(null)
    }
  }, [open])

  // Validate project name (frontend concept - stored in localStorage)
  useEffect(() => {
    if (projectName.trim()) {
      const normalizedInput = projectName.trim().toLowerCase()
      const isDuplicate = existingNames.some(
        (name) => name.toLowerCase() === normalizedInput
      )
      if (isDuplicate) {
        setNameError('Project name already exists, please modify.')
      } else {
        setNameError(null)
      }
    } else {
      setNameError(null)
    }
  }, [projectName, existingNames])

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleSelectPath = async () => {
    const sanitizedName = projectName.trim().toLowerCase().replace(/\s+/g, '-')
    const defaultPath = sanitizedName ? `${sanitizedName}.elf` : 'project.elf'

    const filePath = await save({
      defaultPath,
      filters: [
        {
          name: 'Elfiee Project',
          extensions: ['elf'],
        },
      ],
    })

    if (filePath) {
      setSelectedPath(filePath)
    }
  }

  const handleCreate = async () => {
    if (!projectName.trim() || nameError || !selectedPath) return

    setIsCreating(true)

    onCreate({
      name: projectName.trim(),
      path: selectedPath,
    })

    handleClose()
  }

  const isValid = projectName.trim() && !nameError && selectedPath

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Project Name */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Project Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., User Onboarding"
              className={cn(
                nameError && 'border-destructive focus-visible:ring-destructive'
              )}
            />
            {nameError && (
              <p className="mt-1 text-sm text-destructive">{nameError}</p>
            )}
          </div>

          {/* Location */}
          <LocationBreadcrumb
            projectName={projectName}
            selectedPath={selectedPath}
            onSelectPath={handleSelectPath}
          />

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!isValid || isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
