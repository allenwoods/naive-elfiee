import { Sidebar } from '@/components/dashboard/Sidebar'
import { FilePanel } from '@/components/editor/FilePanel'
import { EditorCanvas } from '@/components/editor/EditorCanvas'
import ContextPanel from '@/components/editor/ContextPanel'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const DocumentEditor = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* Mobile Header - Only visible on mobile */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center border-b border-border bg-background px-4 lg:hidden">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-accent">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex h-full w-[400px] flex-col overflow-hidden p-0 sm:w-[450px]"
          >
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <Sidebar />
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                <FilePanel />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <span className="ml-3 text-sm font-medium">Document Editor</span>
      </div>

      {/* Desktop Layout - Fluid 3-Column Flexbox */}

      {/* Column 1: Global Nav (Fixed ~80px) - Always visible on desktop */}
      <div className="hidden h-full w-20 flex-shrink-0 lg:block">
        <Sidebar />
      </div>

      {/* Column 2: File Panel - Fixed width, NEVER shrinks */}
      <div className="hidden h-full w-64 flex-shrink-0 overflow-hidden border-r border-gray-200 bg-[#F9FAFB] lg:flex">
        <FilePanel />
      </div>

      {/* Column 3: Main Editor Canvas - FLUID, absorbs ALL shrinkage */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden pt-14 lg:pt-0">
        <EditorCanvas />
      </div>

      {/* Column 4: Context Panel - Fixed width, NEVER shrinks */}
      <div className="hidden h-full w-80 flex-shrink-0 overflow-hidden border-l border-gray-200 bg-white lg:flex">
        <ContextPanel />
      </div>
    </div>
  )
}

export default DocumentEditor
