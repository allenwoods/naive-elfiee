import { FolderKanban, FileEdit } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAppStore } from "@/lib/app-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Editor } from "@/bindings";

const navItems = [
  { icon: FolderKanban, path: "/", label: "Projects" },
  { icon: FileEdit, path: "/editor", label: "Editor" },
];

export const Sidebar = () => {
  const { currentFileId, getEditors, getActiveEditor, setActiveEditor } = useAppStore();
  const [open, setOpen] = useState(false);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [activeEditor, setActiveEditorLocal] = useState<Editor | null>(null);

  useEffect(() => {
    if (currentFileId) {
      const fileEditors = getEditors(currentFileId);
      setEditors(fileEditors);
      const active = getActiveEditor(currentFileId);
      setActiveEditorLocal(active || null);
    }
  }, [currentFileId, getEditors, getActiveEditor]);

  const handleSwitchEditor = async (editor: Editor) => {
    if (currentFileId) {
      await setActiveEditor(currentFileId, editor.editor_id);
      setActiveEditorLocal(editor);
      setOpen(false);
    }
  };

  return (
    <aside className="h-full w-20 bg-primary flex flex-col items-center py-6 z-50 flex-shrink-0 min-h-0">
      {/* Logo */}
      <div className="mb-12">
        <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
          <span className="text-accent-foreground font-bold text-xl">A</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-6">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="relative group"
            activeClassName="after:absolute after:left-0 after:top-0 after:w-1 after:h-full after:bg-accent"
          >
            <div className="w-12 h-12 flex items-center justify-center text-primary-foreground/60 group-hover:text-primary-foreground transition-colors">
              <item.icon className="w-5 h-5" />
            </div>
          </NavLink>
        ))}
      </nav>

      {/* User Profile - Editor Switcher */}
      {activeEditor && (
        <div className="mt-auto">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-accent/50 bg-accent"
                title={`${activeEditor.name} - Click to switch`}
              >
                <span className="text-white text-sm font-semibold">
                  {activeEditor.name.charAt(0).toUpperCase()}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="end"
              className="w-56 p-2 bg-popover border border-border shadow-lg"
            >
              <div className="text-xs text-muted-foreground mb-2 px-2">
                Switch Editor
              </div>
              <div className="space-y-1">
                {editors.map((editor) => (
                  <button
                    key={editor.editor_id}
                    onClick={() => handleSwitchEditor(editor)}
                    className={cn(
                      "w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors text-left",
                      activeEditor.editor_id === editor.editor_id
                        ? "bg-accent/20 text-accent-foreground"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-accent">
                      <span className="text-white text-xs font-semibold">
                        {editor.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {editor.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </aside>
  );
};
