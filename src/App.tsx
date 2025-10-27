/**
 * Elfiee - Block-based Note Taking Application
 *
 * Main application component integrating:
 * - File operations (create, open, save, close)
 * - Block management (create, read, update, delete)
 * - UI state management via Zustand
 */

import { Toolbar } from '@/components/Toolbar'
import { BlockList } from '@/components/BlockList'
import { BlockEditor } from '@/components/BlockEditor'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'

function App() {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <Toolbar />
      <Toaster />
      <div className="flex flex-1 overflow-hidden">
        {/* Left side: Block List */}
        <div className="w-1/3 border-r">
          <BlockList />
        </div>

        {/* Right side: Block Editor */}
        <div className="w-2/3">
          <BlockEditor />
        </div>
      </div>
      <SonnerToaster />
    </div>
  )
}

export default App
