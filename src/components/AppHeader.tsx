import { Info, BookOpen, Scale, Search, Upload, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "gemara", label: "גמרא", icon: BookOpen },
  { id: "psak-din", label: "פסקי דין", icon: Scale },
  { id: "smart-index", label: "אינדקס חכם", icon: Library },
  { id: "search", label: "חיפוש", icon: Search },
  { id: "upload", label: "העלאה", icon: Upload },
];

const AppHeader = ({ activeTab, onTabChange }: AppHeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/20 bg-primary shadow-lg">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Right side - Logo and title */}
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
          <h1 className="text-xl md:text-2xl font-bold text-accent tracking-wide">
            גמרא להלכה
          </h1>
        </div>

        {/* Center - Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-primary-foreground/10 rounded-full p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-accent text-accent-foreground shadow-md"
                  : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Left side - Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile tabs */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              activeTab === tab.id
                ? "bg-accent text-accent-foreground"
                : "bg-primary-foreground/10 text-primary-foreground/80"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
};

export default AppHeader;
