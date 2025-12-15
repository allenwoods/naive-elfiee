import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

interface InviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
}

export const InviteModal = ({
  open,
  onOpenChange,
  projectName,
}: InviteModalProps) => {
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleClose = () => {
    setEmail('')
    setIsSending(false)
    onOpenChange(false)
  }

  const handleSendInvite = async () => {
    if (!email.trim()) return
    setIsSending(true)
    // Mock delay
    await new Promise((resolve) => setTimeout(resolve, 1000))
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {projectName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Email or Name
            </label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address or name"
              type="email"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSendInvite}
            disabled={!email.trim() || isSending}
            className="bg-primary hover:bg-primary/90"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Invite'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
