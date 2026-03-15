import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import { lazy, Suspense } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGemaraDownloadEngine } from "@/hooks/useGemaraDownloadEngine";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

const FloatingGemaraNav = lazy(() => import("./FloatingGemaraNav"));
const GemaraDownloadFloat = lazy(() => import("./GemaraDownloadFloat"));

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayoutInner = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    activeTab, 
    setActiveTab, 
    setSelectedMasechet, 
    isPinned, 
    setIsPinned 
  } = useAppContext();
  const { open: sidebarOpen } = useSidebar();
  const isMobile = useIsMobile();

  // Start the background download engine (processes queued jobs)
  useGemaraDownloadEngine();

  const handleTabChange = (tab: string) => {
    if (tab === "embedpdf-viewer") {
      navigate("/embedpdf-viewer");
      return;
    }
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
  // Reserve margin when pinned OR when unpinned but sidebar is open (hover)
  const shouldReserveSpace = !isMobile && (sidebarIsPinned || sidebarOpen);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Main content - reflows based on sidebar state */}
      <div className={cn(
        "flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300",
        shouldReserveSpace ? "md:mr-[--sidebar-width]" : ""
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

      {/* Gemara Download Progress Float */}
      <Suspense fallback={null}>
        <GemaraDownloadFloat />
      </Suspense>
    </div>
  );
};

const AppLayout = ({ children }: AppLayoutProps) => {
  const { isPinned } = useAppContext();
  const isMobile = useIsMobile();
  const sidebarIsPinned = isPinned ?? false;
  const defaultSidebarOpen = isMobile ? false : sidebarIsPinned;

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarProvider>
  );
};

export default AppLayout;
