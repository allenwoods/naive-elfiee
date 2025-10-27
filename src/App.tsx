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
import { ErrorDisplay } from '@/components/ErrorDisplay'

function App() {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <Toolbar />
      <ErrorDisplay />
      <div className="flex-1 overflow-hidden">
        <BlockList />
      </div>
    </div>
  )
}

export default App
