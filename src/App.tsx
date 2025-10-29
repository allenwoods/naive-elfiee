/**
 * Elfiee - Block-based Note Taking Application
 *
 * Main application component integrating:
 * - File operations (create, open, save, close)
 * - Block management (create, read, update, delete)
 * - UI state management via Zustand
 */

import { useState } from 'react'
import { Toolbar } from '@/components/Toolbar'
import { BlockList } from '@/components/BlockList'
import { BlockEditor } from '@/components/BlockEditor'
import { EventViewer } from '@/components/EventViewer'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'

type TabType = 'editor' | 'events'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('editor')

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <Toolbar />
      <Toaster />
      <div className="flex flex-1 overflow-hidden">
        {/* Left side: Block List */}
        <div className="w-1/3 border-r">
          <BlockList />
        </div>

        {/* Right side: Tabbed Content */}
        <div className="flex w-2/3 flex-col">
          {/* Tab Navigation */}
          <div className="flex border-b">
            <Button
              variant={activeTab === 'editor' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('editor')}
              className="rounded-none"
            >
              Editor
            </Button>
            <Button
              variant={activeTab === 'events' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('events')}
              className="rounded-none"
            >
              Events
            </Button>
          </div>

          {/* Tab Content */}
          <div className="flex-1">
            {activeTab === 'editor' ? <BlockEditor /> : <EventViewer />}
          </div>
        </div>
      </div>
      <SonnerToaster />
    </div>
  )
}

export default App
