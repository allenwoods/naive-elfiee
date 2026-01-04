import { useState, useMemo } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Editor } from '@/bindings'

interface AddCollaboratorDialogProps {
  fileId: string
  existingEditors: Editor[]
  allEditors: Editor[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (editor: Editor) => void
}

export const AddCollaboratorDialog = ({
  existingEditors,
  allEditors,
  open,
  onOpenChange,
  onSuccess,
}: AddCollaboratorDialogProps) => {
  const [selectedEditorId, setSelectedEditorId] = useState<string>('')
  const [isAdding, setIsAdding] = useState(false)

  // Get editors that are not already collaborators
  const availableEditors = useMemo(() => {
    const existingIds = new Set(existingEditors.map((e) => e.editor_id))
    return allEditors.filter((e) => !existingIds.has(e.editor_id))
  }, [allEditors, existingEditors])

  const handleAdd = async () => {
    if (!selectedEditorId) return

    const selectedEditor = availableEditors.find(
      (e) => e.editor_id === selectedEditorId
    )
    if (!selectedEditor) return

    setIsAdding(true)
    try {
      // Close dialog
      onOpenChange(false)
      // Call success callback with the selected editor
      onSuccess?.(selectedEditor)
      // Reset selection
      setSelectedEditorId('')
    } catch (error) {
      console.error('Failed to add collaborator:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form when closing
      setSelectedEditorId('')
    }
    onOpenChange(open)
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
            Select an existing user to add as collaborator for this block.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="editor-select">Select User</Label>
            {availableEditors.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No available users to add. All existing users are already
                collaborators.
              </p>
            ) : (
              <Select
                value={selectedEditorId}
                onValueChange={setSelectedEditorId}
                disabled={isAdding}
              >
                <SelectTrigger id="editor-select">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableEditors.map((editor) => (
                    <SelectItem key={editor.editor_id} value={editor.editor_id}>
                      <div className="flex items-center gap-2">
                        {editor.editor_type === 'Bot' ? (
                          <Bot className="h-4 w-4 text-purple-500" />
                        ) : (
                          <User className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="font-medium">{editor.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({editor.editor_id.slice(0, 8)}...)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isAdding}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={isAdding || !selectedEditorId}
          >
            {isAdding ? 'Adding...' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
