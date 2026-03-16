import { Info, BookOpen, Scale, Search, Upload, Library, User, LogOut, LogIn, ArrowDownToLine, BookMarked, History, CalendarDays, GitCompareArrows, Share2, MoreHorizontal, Menu, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "gemara", label: "גמרא", icon: BookOpen },
  { id: "psak-din", label: "פסקי דין", icon: Scale },
  { id: "smart-index", label: "אינדקס חכם", icon: Library },
  { id: "advanced-index", label: "אינדקס מתקדם", icon: BookMarked },
  { id: "global-search", label: "חיפוש", icon: Search },
  { id: "upload", label: "העלאה", icon: Upload },
  { id: "download", label: "הורדה", icon: ArrowDownToLine },
  { id: "learning-history", label: "היסטוריה", icon: History },
  { id: "daf-yomi", label: "דף יומי", icon: CalendarDays },
  { id: "compare", label: "השוואה", icon: GitCompareArrows },
  { id: "knowledge-graph", label: "גרף ידע", icon: Share2 },
];

const mainTabs = tabs.slice(0, 7);
const moreTabs = tabs.slice(7);
const mobileMainTabs = tabs.slice(0, 4);
const mobileMoreTabs = tabs.slice(4);

const AppHeader = ({ activeTab, onTabChange }: AppHeaderProps) => {
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const { setOpen } = useSidebar();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-accent/30 bg-primary shadow-lg safe-area-top">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Right side - Logo and title */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10 min-h-[44px] min-w-[44px] rounded-full border border-primary-foreground/20"
            onClick={() => setOpen(true)}
            title="פתח סיידבר"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold text-accent tracking-wide">
            גמרא להלכה
          </h1>
        </div>

        {/* Center - Tabs */}
        <nav className="hidden md:flex flex-1 items-center gap-1 mx-2 min-w-0 overflow-x-auto scrollbar-hide">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0",
                activeTab === tab.id
                  ? "bg-accent text-accent-foreground shadow-md"
                  : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
          {moreTabs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                    moreTabs.some(t => t.id === activeTab)
                      ? "bg-accent text-accent-foreground shadow-md"
                      : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span>עוד</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-right">
                {moreTabs.map((tab) => (
                  <DropdownMenuItem
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer",
                      activeTab === tab.id && "bg-accent/20 font-bold"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        {/* Left side - Actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-right">
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="h-4 w-4 ms-2" />
                  התנתק
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/10 gap-2"
              onClick={() => navigate("/auth")}
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden md:inline">התחבר</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile tabs - reduced and cleaner */}
      <nav className="md:hidden flex items-center gap-1.5 px-3 pb-3 overflow-x-auto scrollbar-hide border-t border-primary-foreground/15">
        {mobileMainTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap min-h-[40px]",
              activeTab === tab.id
                ? "bg-accent text-accent-foreground"
                : "bg-primary-foreground/10 text-primary-foreground/80"
            )}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}

        {mobileMoreTabs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap min-h-[40px]",
                  mobileMoreTabs.some(t => t.id === activeTab)
                    ? "bg-accent text-accent-foreground"
                    : "bg-primary-foreground/10 text-primary-foreground/80"
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span>עוד</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-right">
              {mobileMoreTabs.map((tab) => (
                <DropdownMenuItem
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    activeTab === tab.id && "bg-accent/20 font-bold"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
    </header>
  );
};

export default AppHeader;
