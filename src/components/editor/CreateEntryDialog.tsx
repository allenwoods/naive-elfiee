import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface CreateEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
  type: 'file' | 'directory'
  parentPath: string
  source: 'outline' | 'linked'
}

export const CreateEntryDialog = ({
  open,
  onOpenChange,
  onConfirm,
  type,
  parentPath,
  source,
}: CreateEntryDialogProps) => {
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) setName('')
  }, [open])

  const handleConfirm = () => {
    const trimmed = name.trim()
    if (trimmed) {
      onConfirm(trimmed)
      onOpenChange(false)
    }
  }

  const title = `Create New ${type === 'file' ? (source === 'outline' ? 'Document' : 'File') : 'Folder'}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'file' ? 'example.md' : 'New Folder'}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              Location:{' '}
              <span className="font-mono">{parentPath || 'root'}/</span>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
