import { useState } from 'react'
import { UserPlus, User, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAppStore } from '@/lib/app-store'
import type { Editor, EditorType } from '@/bindings'

interface AddCollaboratorDialogProps {
  fileId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (newEditor: Editor) => void
}

export const AddCollaboratorDialog = ({
  fileId,
  open,
  onOpenChange,
  onSuccess,
}: AddCollaboratorDialogProps) => {
  const [name, setName] = useState('')
  const [editorType, setEditorType] = useState<EditorType>('Human')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { createEditor } = useAppStore()

  const handleCreate = async () => {
    // Basic UI validation - empty name check only
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name cannot be empty')
      return
    }

    setError(null)
    setIsCreating(true)

    try {
      const newEditor = await createEditor(fileId, trimmedName, editorType)
      // Reset form
      setName('')
      setEditorType('Human')
      setError(null)
      // Close dialog
      onOpenChange(false)
      // Call success callback with the new editor
      onSuccess?.(newEditor)
    } catch (error) {
      console.error('Failed to create collaborator:', error)
      // Error toast is already shown by app-store
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form when closing
      setName('')
      setEditorType('Human')
      setError(null)
    }
    onOpenChange(open)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Collaborator
          </DialogTitle>
          <DialogDescription>
            Create a new collaborator to share this file with.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Enter collaborator name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Type</Label>
            <RadioGroup
              value={editorType}
              onValueChange={(value) => setEditorType(value as EditorType)}
              disabled={isCreating}
              className="flex flex-row gap-6 pt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Human" id="human" />
                <Label
                  htmlFor="human"
                  className="flex cursor-pointer items-center gap-2 font-normal"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Human</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Bot" id="bot" />
                <Label
                  htmlFor="bot"
                  className="flex cursor-pointer items-center gap-2 font-normal"
                >
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <span>Bot</span>
                  <span className="text-xs text-muted-foreground">(AI)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}