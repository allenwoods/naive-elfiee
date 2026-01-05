import { useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface AddWorkdirDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
}

export const AddWorkdirDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: AddWorkdirDialogProps) => {
  const [name, setName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('')
    }
    onOpenChange(open)
  }

  const handleConfirm = async () => {
    if (!name.trim()) return

    setIsProcessing(true)
    try {
      await onConfirm(name.trim())
      handleOpenChange(false)
    } catch (error) {
      // Error handling is done by parent component
      console.error(error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Add Work Directory
          </DialogTitle>
          <DialogDescription>
            Create a new directory to organize your blocks and files.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="workdir-name">Directory Name</Label>
            <Input
              id="workdir-name"
              placeholder="e.g. Components, Utils, Assets"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim() && !isProcessing) {
                  e.preventDefault()
                  handleConfirm()
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || !name.trim()}
          >
            {isProcessing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
