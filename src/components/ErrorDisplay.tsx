/**
 * ErrorDisplay Component
 *
 * Displays error messages with dismiss functionality
 */

import { useAppStore } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { X, AlertCircle } from 'lucide-react'

export function ErrorDisplay() {
  const { error, clearError } = useAppStore()

  if (!error) return null

  return (
    <div className="bg-destructive/10 border-destructive/20 m-4 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-destructive mb-1 font-semibold">Error</h3>
          <p className="text-destructive/90 text-sm break-words">{error}</p>
        </div>
        <Button
          onClick={clearError}
          variant="ghost"
          size="icon"
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
