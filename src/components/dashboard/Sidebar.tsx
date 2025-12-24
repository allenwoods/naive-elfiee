import { FolderKanban, FileEdit } from 'lucide-react'
import { NavLink } from '@/components/NavLink'

const navItems = [
  { icon: FolderKanban, path: '/', label: 'Projects' },
  { icon: FileEdit, path: '/editor', label: 'Editor' },
]

export const Sidebar = () => {
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
    </aside>
  )
}
