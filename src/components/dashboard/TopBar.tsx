import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TopBarProps {
  title?: string;
  searchPlaceholder?: string;
}

export const TopBar = ({
  title = "Dashboard",
  searchPlaceholder = "Ask anything about projects or principles...",
}: TopBarProps) => {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-8 py-4">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>

        <div className="relative w-full max-w-2xl mx-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            className="pl-12 h-12 bg-card border-border rounded-2xl text-base"
          />
        </div>

        {/* Spacer to balance layout */}
        <div className="w-10" />
      </div>
    </header>
  );
};
