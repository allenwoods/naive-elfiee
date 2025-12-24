import { useState } from 'react'
import { X, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImportRepositoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (name: string, source: string) => void
}

type TabType = 'local' | 'agentour' | 'github'

export const ImportRepositoryModal = ({
  open,
  onOpenChange,
  onImport,
}: ImportRepositoryModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('local')

  if (!open) return null

  const handleLocalImport = () => {
    onImport('', 'Local')
    onOpenChange(false)
  }

  const tabs: { id: TabType; label: string; disabled?: boolean }[] = [
    { id: 'local', label: 'Local' },
    { id: 'agentour', label: 'Agentour', disabled: true },
    { id: 'github', label: 'GitHub', disabled: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[520px] max-w-[95vw] overflow-hidden rounded-xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Import Repository
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-border px-6 pt-4">
          <div className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={cn(
                  'relative flex items-center gap-1.5 pb-3 text-sm font-medium transition-colors',
                  tab.disabled
                    ? 'cursor-not-allowed text-muted-foreground/50'
                    : activeTab === tab.id
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {tab.disabled && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Soon
                  </span>
                )}
                {activeTab === tab.id && !tab.disabled && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[200px] p-6">
          {activeTab === 'local' && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 font-medium">
                Import from Local File System
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Select a directory from your computer to import it as a
                workspace block.
              </p>
              <Button onClick={handleLocalImport} className="w-full sm:w-auto">
                Select Directory
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
