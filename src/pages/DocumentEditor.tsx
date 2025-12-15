import { Sidebar } from "@/components/dashboard/Sidebar";
import { FilePanel } from "@/components/editor/FilePanel";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { ContextPanel } from "@/components/editor/ContextPanel";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const DocumentEditor = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen flex w-full overflow-hidden bg-white">
      {/* Mobile Header - Only visible on mobile */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-background border-b border-border flex items-center px-4 lg:hidden z-50">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-accent">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="p-0 w-[400px] sm:w-[450px] h-full flex flex-col overflow-hidden"
          >
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <Sidebar />
              <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                <FilePanel />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <span className="ml-3 text-sm font-medium">Document Editor</span>
      </div>

      {/* Desktop Layout - Fluid 3-Column Flexbox */}

      {/* Column 1: Global Nav (Fixed ~80px) - Always visible on desktop */}
      <div className="hidden lg:block w-20 flex-shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Column 2: File Panel - Fixed width, NEVER shrinks */}
      <div className="hidden lg:flex w-64 flex-shrink-0 h-full border-r border-gray-200 bg-[#F9FAFB] overflow-hidden">
        <FilePanel />
      </div>

      {/* Column 3: Main Editor Canvas - FLUID, absorbs ALL shrinkage */}
      <div className="flex-1 min-w-0 h-full flex flex-col pt-14 lg:pt-0 overflow-hidden">
        <EditorCanvas />
      </div>

      {/* Column 4: Context Panel - Fixed width, NEVER shrinks */}
      <div className="hidden lg:flex w-80 flex-shrink-0 h-full border-l border-gray-200 bg-white overflow-hidden">
        <ContextPanel />
      </div>
    </div>
  );
};

export default DocumentEditor;
