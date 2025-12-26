import { FolderKanban, FileEdit, User } from 'lucide-react'
import { NavLink } from '@/components/NavLink'
import { useAppStore } from '@/lib/app-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const navItems = [
  { icon: FolderKanban, path: '/', label: 'Projects' },
  { icon: FileEdit, path: '/editor', label: 'Editor' },
]

export const Sidebar = () => {
  const { currentFileId, getEditors, getActiveEditor, setActiveEditor } =
    useAppStore()

  const editors = currentFileId ? getEditors(currentFileId) : []
  const activeEditor = currentFileId ? getActiveEditor(currentFileId) : null

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

      {/* User Switcher */}
      <div className="mt-auto">
        {currentFileId && activeEditor ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <div
                className="group flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                title={`Current user: ${activeEditor.name}`}
              >
                <Avatar className="h-9 w-9 border-2 border-transparent transition-all group-hover:border-accent">
                  <AvatarFallback className="bg-accent text-sm font-bold text-accent-foreground">
                    {activeEditor.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="ml-2 w-56">
              <DropdownMenuLabel>Switch User</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {editors.map((editor) => (
                <DropdownMenuItem
                  key={editor.editor_id}
                  onClick={() =>
                    setActiveEditor(currentFileId, editor.editor_id)
                  }
                  className="flex cursor-pointer items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  <span
                    className={cn(
                      'flex-1 truncate',
                      editor.editor_id === activeEditor.editor_id && 'font-bold'
                    )}
                  >
                    {editor.name}
                  </span>
                  {editor.editor_id === activeEditor.editor_id && (
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="h-12 w-12" /> // Placeholder to maintain spacing
        )}
      </div>
    </aside>
  )
}
