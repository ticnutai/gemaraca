import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import FloatingGemaraNav from "./FloatingGemaraNav";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

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

  return (
    <SidebarProvider defaultOpen={sidebarIsPinned}>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        {/* Main content - takes full width when sidebar is unpinned */}
        <div className={cn(
          "flex-1 flex flex-col min-h-screen overflow-x-hidden transition-all duration-300",
          sidebarIsPinned ? "md:mr-[--sidebar-width]" : "w-full"
        )}>
          <AppHeader 
            activeTab={activeTab} 
            onTabChange={handleTabChange}
          />
          
          <main className="flex-1 overflow-x-hidden">
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
        />

        {/* Floating Navigation Button - appears on all pages */}
        <FloatingGemaraNav />
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;