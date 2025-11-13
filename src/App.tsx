/**
 * Elfiee - Block-based Note Taking Application
 *
 * Main application component integrating:
 * - File operations (create, open, save, close)
 * - Block management (create, read, update, delete)
 * - UI state management via Zustand
 */

import { useState, useEffect } from 'react'
import { Toolbar } from '@/components/Toolbar'
import { BlockList } from '@/components/BlockList'
import { BlockEditor } from '@/components/BlockEditor'
import { EventViewer } from '@/components/EventViewer'
import { Terminal } from '@/components/Terminal'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { useAppStore } from '@/lib/app-store'

type TabType = 'editor' | 'events' | 'terminal'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('editor')
  const { activeFileId, getSelectedBlock } = useAppStore()
  const selectedBlock = activeFileId ? getSelectedBlock(activeFileId) : null

  // 当选中的block类型改变时，自动切换到合适的tab
  useEffect(() => {
    if (selectedBlock) {
      if (selectedBlock.block_type === 'markdown') {
        // markdown类型：如果当前tab是terminal，切换到editor
        if (activeTab === 'terminal') {
          setActiveTab('editor')
        }
      } else if (selectedBlock.block_type === 'terminal') {
        // terminal类型：如果当前tab是editor，切换到terminal
        if (activeTab === 'editor') {
          setActiveTab('terminal')
        }
      }
    }
  }, [selectedBlock?.block_type, activeTab])

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
            {/* 根据选中block类型显示不同tab */}
            {(!selectedBlock || selectedBlock.block_type === 'markdown') && (
              <Button
                variant={activeTab === 'editor' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('editor')}
                className="rounded-none"
              >
                Editor
              </Button>
            )}
            {(!selectedBlock || selectedBlock.block_type === 'terminal') && (
              <Button
                variant={activeTab === 'terminal' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('terminal')}
                className="rounded-none"
              >
                Terminal
              </Button>
            )}
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
            {activeTab === 'editor' && <BlockEditor />}
            {activeTab === 'events' && <EventViewer />}
            {activeTab === 'terminal' && <Terminal />}
          </div>
        </div>
      </div>
      <SonnerToaster />
    </div>
  )
}

export default App
