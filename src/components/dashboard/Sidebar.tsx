import { FolderKanban, FileEdit } from 'lucide-react'
import { NavLink } from '@/components/NavLink'
import { useAppStore } from '@/lib/app-store'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Editor } from '@/bindings'

const navItems = [
  { icon: FolderKanban, path: '/', label: 'Projects' },
  { icon: FileEdit, path: '/editor', label: 'Editor' },
]

export const Sidebar = () => {
  const { currentFileId, getEditors, getActiveEditor, setActiveEditor } =
    useAppStore()
  const [open, setOpen] = useState(false)
  const [editors, setEditors] = useState<Editor[]>([])
  const [activeEditor, setActiveEditorLocal] = useState<Editor | null>(null)

  useEffect(() => {
    if (currentFileId) {
      const fileEditors = getEditors(currentFileId)
      setEditors(fileEditors)
      const active = getActiveEditor(currentFileId)
      setActiveEditorLocal(active || null)
    }
  }, [currentFileId, getEditors, getActiveEditor])

  const handleSwitchEditor = async (editor: Editor) => {
    if (currentFileId) {
      await setActiveEditor(currentFileId, editor.editor_id)
      setActiveEditorLocal(editor)
      setOpen(false)
    }
  }

  return (
    <aside className="z-50 flex h-full min-h-0 w-20 flex-shrink-0 flex-col items-center bg-primary py-6">
      {/* Logo */}
      <div className="mb-12">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
          <span className="text-xl font-bold text-accent-foreground">A</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-6">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="group relative"
            activeClassName="after:absolute after:left-0 after:top-0 after:w-1 after:h-full after:bg-accent"
          >
            <div className="flex h-12 w-12 items-center justify-center text-primary-foreground/60 transition-colors group-hover:text-primary-foreground">
              <item.icon className="h-5 w-5" />
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
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-accent transition-all hover:ring-2 hover:ring-accent/50"
                title={`${activeEditor.name} - Click to switch`}
              >
                <span className="text-sm font-semibold text-white">
                  {activeEditor.name.charAt(0).toUpperCase()}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="end"
              className="w-56 border border-border bg-popover p-2 shadow-lg"
            >
              <div className="mb-2 px-2 text-xs text-muted-foreground">
                Switch Editor
              </div>
              <div className="space-y-1">
                {editors.map((editor) => (
                  <button
                    key={editor.editor_id}
                    onClick={() => handleSwitchEditor(editor)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                      activeEditor.editor_id === editor.editor_id
                        ? 'bg-accent/20 text-accent-foreground'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent">
                      <span className="text-xs font-semibold text-white">
                        {editor.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
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
  )
}
