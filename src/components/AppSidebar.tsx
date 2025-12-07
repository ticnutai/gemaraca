import { useState, useEffect, useRef } from "react";
import { BookOpen, Scale, Search, Upload, Pin, PinOff, ChevronDown, ChevronLeft } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MASECHTOT, SEDARIM } from "@/lib/masechtotData";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMasechetSelect?: (masechetHebrewName: string) => void;
  isPinned?: boolean;
  onPinToggle?: () => void;
}

const menuItems = [
  {
    id: "gemara",
    title: "גמרא",
    icon: BookOpen,
    description: "לימוד מסכתות ודפים",
  },
  {
    id: "psak-din",
    title: "פסקי דין",
    icon: Scale,
    description: "צפייה בפסקי דין",
  },
  {
    id: "search",
    title: "חיפוש פסקי דין",
    icon: Search,
    description: "חיפוש במאגר",
  },
  {
    id: "upload",
    title: "העלאה",
    icon: Upload,
    description: "העלאת מסמכים",
  },
];

const AppSidebar = ({ 
  activeTab, 
  onTabChange, 
  onMasechetSelect,
  isPinned: isPinnedProp,
  onPinToggle: onPinToggleProp 
}: AppSidebarProps) => {
  const { setOpen, open: sidebarOpen } = useSidebar();
  const [isPinnedLocal, setIsPinnedLocal] = useState(true);
  const [expandedSedarim, setExpandedSedarim] = useState<Set<string>>(new Set());
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use prop or local state
  const isPinned = isPinnedProp !== undefined ? isPinnedProp : isPinnedLocal;

  // Handle hover zone for opening sidebar when unpinned
  useEffect(() => {
    if (isPinned) return;

    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const hoverZone = 30; // pixels from right edge
      
      // Check if mouse is in the right edge zone
      if (windowWidth - e.clientX <= hoverZone) {
        if (!isHovered && !sidebarOpen) {
          // Clear any pending close timeout
          if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
          }
          setIsHovered(true);
          setOpen(true);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isPinned, isHovered, sidebarOpen, setOpen]);

  // Handle closing sidebar after leaving hover
  const handleMouseLeave = () => {
    if (isPinned) return;
    
    // Close after 2 seconds delay
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setOpen(false);
    }, 2000);
  };

  const handleMouseEnter = () => {
    // Cancel close timeout if user returns to sidebar
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const toggleSeder = (seder: string) => {
    const newExpanded = new Set(expandedSedarim);
    if (newExpanded.has(seder)) {
      newExpanded.delete(seder);
    } else {
      newExpanded.add(seder);
    }
    setExpandedSedarim(newExpanded);
  };

  const handlePinToggle = () => {
    if (onPinToggleProp) {
      onPinToggleProp();
    } else {
      setIsPinnedLocal(!isPinnedLocal);
    }
    if (!isPinned) {
      setOpen(true);
    }
  };

  // קיבוץ מסכתות לפי סדר
  const groupedMasechtot = SEDARIM.map(seder => ({
    seder,
    masechtot: MASECHTOT.filter(m => m.seder === seder)
  }));

  return (
    <Sidebar 
      side="right" 
      className={cn(
        "border-l border-border/50 transition-all duration-300",
        !isPinned && !sidebarOpen && "translate-x-full opacity-0 pointer-events-none",
        !isPinned && sidebarOpen && "fixed right-0 top-0 h-full z-50 shadow-2xl"
      )}
      collapsible="none"
      variant={isPinned ? "sidebar" : "floating"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader className="border-b border-border/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">ניווט ראשי</h2>
            <p className="text-xs text-muted-foreground">מסכתות ופסקי דין</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePinToggle}
            className="h-8 w-8"
            title={isPinned ? "בטל נעיצה" : "נעץ סיידבר"}
          >
            {isPinned ? (
              <Pin className="h-4 w-4 text-accent" />
            ) : (
              <PinOff className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2">
        {/* תפריט ניווט */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs mb-2 px-2">
            תפריט
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onTabChange(item.id)}
                    isActive={activeTab === item.id}
                    tooltip={item.description}
                    className={cn(
                      "rounded-xl py-2.5 px-3 transition-all duration-200",
                      activeTab === item.id 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "hover:bg-secondary/80 text-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4",
                      activeTab === item.id ? "text-accent" : "text-muted-foreground"
                    )} />
                    <span className="font-medium text-sm">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* רשימת מסכתות מתקפלת */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-muted-foreground text-xs mb-2 px-2">
            מסכתות הגמרא
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-1">
              {groupedMasechtot.map((group) => (
                <div key={group.seder} className="rounded-lg overflow-hidden">
                  {/* כותרת סדר */}
                  <button
                    onClick={() => toggleSeder(group.seder)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-all",
                      "bg-secondary/50 hover:bg-secondary text-foreground rounded-lg",
                      expandedSedarim.has(group.seder) && "rounded-b-none"
                    )}
                  >
                    <span>סדר {group.seder}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {group.masechtot.length} מסכתות
                      </span>
                      {expandedSedarim.has(group.seder) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* רשימת מסכתות */}
                  {expandedSedarim.has(group.seder) && (
                    <div className="bg-muted/30 rounded-b-lg border-x border-b border-border/30">
                      {group.masechtot.map((masechet, index) => (
                        <button
                          key={masechet.englishName}
                          onClick={() => {
                            if (onMasechetSelect) {
                              onMasechetSelect(masechet.hebrewName);
                            } else {
                              onTabChange("gemara");
                            }
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-2 text-sm transition-all",
                            "hover:bg-accent/10 text-foreground",
                            index !== group.masechtot.length - 1 && "border-b border-border/20"
                          )}
                        >
                          <span>{masechet.hebrewName}</span>
                          <span className="text-xs text-muted-foreground">
                            {masechet.maxDaf - 1} דפים
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-3">
        <div className="text-center text-xs text-muted-foreground">
          גמרא להלכה © 2024
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
