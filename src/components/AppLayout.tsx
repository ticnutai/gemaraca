import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import { lazy, Suspense } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const FloatingGemaraNav = lazy(() => import("./FloatingGemaraNav"));

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    activeTab, 
    setActiveTab, 
    setSelectedMasechet, 
    isPinned, 
    setIsPinned 
  } = useAppContext();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Navigate to home if on a detail page
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const handleMasechetSelect = (masechetHebrewName: string) => {
    setSelectedMasechet(masechetHebrewName);
    setActiveTab("gemara");
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const handlePinToggle = () => {
    setIsPinned(!(isPinned ?? false));
  };

  // When sidebar is not pinned, main content should take full width
  const sidebarIsPinned = isPinned ?? true;
  const isMobile = useIsMobile();

  // On mobile, sidebar should always start closed regardless of pin state
  const defaultSidebarOpen = isMobile ? false : sidebarIsPinned;

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <div className="min-h-screen flex w-full bg-background">
        {/* Main content - takes full width when sidebar is unpinned */}
        <div className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          sidebarIsPinned && !isMobile ? "md:me-[--sidebar-width]" : "w-full"
        )}>
          <AppHeader 
            activeTab={activeTab} 
            onTabChange={handleTabChange}
          />
          
          <main className="flex-1">
            {children}
          </main>
        </div>

        {/* Sidebar - fixed position when pinned, floating when unpinned */}
        <AppSidebar 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          onMasechetSelect={handleMasechetSelect}
          isPinned={sidebarIsPinned}
          onPinToggle={handlePinToggle}
          isMobile={isMobile}
        />

        {/* Floating Navigation Button - lazy loaded */}
        <Suspense fallback={null}>
          <FloatingGemaraNav />
        </Suspense>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;