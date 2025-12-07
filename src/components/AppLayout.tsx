import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import FloatingGemaraNav from "./FloatingGemaraNav";
import { useAppContext } from "@/contexts/AppContext";

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

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden max-w-[100vw]">
        
        <AppSidebar 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          onMasechetSelect={handleMasechetSelect}
          isPinned={isPinned ?? true}
          onPinToggle={handlePinToggle}
        />
        
        <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden max-w-full">
          <AppHeader 
            activeTab={activeTab} 
            onTabChange={handleTabChange}
          />
          
          <main className="flex-1 overflow-x-hidden">
            {children}
          </main>
        </div>

        {/* Floating Navigation Button - appears on all pages */}
        <FloatingGemaraNav />
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
