import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
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

  const sidebarIsPinned = isPinned ?? false;
  const isMobile = useIsMobile();
  const { open: sidebarOpen } = useSidebar();

  // On mobile, sidebar should always start closed
  const defaultSidebarOpen = isMobile ? false : sidebarIsPinned;

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <div className="min-h-screen flex w-full bg-background">
        {/* Main content - reflows based on sidebar pin state */}
        <div className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          // When pinned, reserve space for sidebar on the right
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

        {/* Sidebar */}
        <AppSidebar 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          onMasechetSelect={handleMasechetSelect}
          isPinned={sidebarIsPinned}
          onPinToggle={handlePinToggle}
          isMobile={isMobile}
        />

        {/* Floating Navigation Button */}
        <Suspense fallback={null}>
          <FloatingGemaraNav />
        </Suspense>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
