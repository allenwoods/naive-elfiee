import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, FolderOpen } from 'lucide-react'
import * as dialog from '@tauri-apps/plugin-dialog'

interface ImportProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (project: { name: string; path: string }) => void
  existingNames: string[]
}

export const ImportProjectModal = ({
  open,
  onOpenChange,
  onImport,
  existingNames,
}: ImportProjectModalProps) => {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedFilePath(null)
      setProjectName('')
      setNameError(null)
      setIsImporting(false)
    }
  }, [open])

  // Validate name on change
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

  const handleSelectFile = async () => {
    const selected = await dialog.open({
      multiple: false,
      filters: [
        {
          name: 'Elfiee Project',
          extensions: ['elf'],
        },
      ],
    })

    if (selected) {
      const filePath = selected as string
      setSelectedFilePath(filePath)

      // Extract filename and pre-fill project name
      const fileName = filePath.split(/[/\\]/).pop() || ''
      const nameWithoutExt = fileName.replace(/\.elf$/, '')
      setProjectName(nameWithoutExt)
    }
  }

  const handleImport = async () => {
    if (!selectedFilePath || !projectName.trim() || nameError) return

    setIsImporting(true)

    onImport({
      name: projectName.trim(),
      path: selectedFilePath,
    })

    handleClose()
  }

  const isValid = selectedFilePath && projectName.trim() && !nameError

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* File Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Select .elf File <span className="text-destructive">*</span>
            </label>
            {selectedFilePath ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 px-3 py-2.5">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-foreground">
                    {selectedFilePath.split(/[/\\]/).pop()}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedFilePath}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectFile}
                  className="h-7 gap-1.5 px-2"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span className="text-xs">Change</span>
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectFile}
                className="w-full justify-center gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <FolderOpen className="h-4 w-4" />
                Choose File
              </Button>
            )}
          </div>
          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!isValid || isImporting}
              className="bg-primary hover:bg-primary/90"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Project'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
