import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface TopBarProps {
  title?: string
  searchPlaceholder?: string
}

export const TopBar = ({
  title = 'Dashboard',
  searchPlaceholder = 'Ask anything about projects or principles...',
}: TopBarProps) => {
  return (
    <header className="bg-background/80 border-border sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="flex items-center justify-between px-8 py-4">
        <h1 className="text-foreground text-3xl font-bold">{title}</h1>

        <div className="relative mx-8 w-full max-w-2xl">
          <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            className="bg-card border-border h-12 rounded-2xl pl-12 text-base"
          />
        </div>

        {/* Spacer to balance layout */}
        <div className="w-10" />
      </div>
    </header>
  )
}
