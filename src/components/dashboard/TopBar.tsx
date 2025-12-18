import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface TopBarProps {
  title?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
}

export const TopBar = ({
  title = 'Dashboard',
  searchPlaceholder = 'Ask anything about projects or principles...',
  searchValue = '',
  onSearchChange,
}: TopBarProps) => {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-8 py-4">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>

        <div className="relative mx-8 w-full max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="h-12 rounded-2xl border-border bg-card pl-12 text-base"
          />
        </div>

        {/* Spacer to balance layout */}
        <div className="w-10" />
      </div>
    </header>
  )
}
