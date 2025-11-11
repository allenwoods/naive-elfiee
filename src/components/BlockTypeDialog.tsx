/**
 * BlockTypeDialog Component
 *
 * A dialog for selecting the type of block to create
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Terminal, FileText, X, Check } from 'lucide-react'

export interface BlockTypeDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (name: string, blockType: string) => void
  isLoading?: boolean
}

const BLOCK_TYPES = [
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Text content with markdown formatting',
    icon: FileText,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Interactive terminal for command execution',
    icon: Terminal,
  },
] as const

export function BlockTypeDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: BlockTypeDialogProps) {
  const [blockName, setBlockName] = useState('')
  const [selectedType, setSelectedType] = useState<string>('')

  const handleSubmit = () => {
    if (!blockName.trim() || !selectedType) {
      return
    }
    onConfirm(blockName.trim(), selectedType)
    handleClose()
  }

  const handleClose = () => {
    setBlockName('')
    setSelectedType('')
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    } else if (e.key === 'Enter' && blockName.trim() && selectedType) {
      handleSubmit()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background w-full max-w-md rounded-lg border p-6 shadow-lg">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create New Block</h2>
          <Button onClick={handleClose} variant="ghost" size="icon" disabled={isLoading}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Block Name Input */}
          <div className="space-y-2">
            <label htmlFor="blockName" className="text-sm font-medium">
              Block Name
            </label>
            <Input
              id="blockName"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter block name"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {/* Block Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Block Type</label>
            <div className="space-y-2">
              {BLOCK_TYPES.map((type) => {
                const Icon = type.icon
                return (
                  <div
                    key={type.id}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      selectedType === type.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !isLoading && setSelectedType(type.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-medium">{type.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                      {selectedType === type.id && (
                        <div className="mt-0.5 shrink-0 text-primary">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!blockName.trim() || !selectedType || isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Block'}
          </Button>
        </div>
      </div>
    </div>
  )
}