/**
 * ErrorDisplay Component
 *
 * Displays error messages with dismiss functionality
 */

import { useAppStore } from '@/lib/app-store';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';

export function ErrorDisplay() {
  const { error, clearError } = useAppStore();

  if (!error) return null;

  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 m-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-destructive mb-1">Error</h3>
          <p className="text-sm text-destructive/90 break-words">{error}</p>
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
  );
}
