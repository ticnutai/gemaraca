import { useState } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import AppHeader from "@/components/AppHeader";
import GemaraTab from "@/components/GemaraTab";
import PsakDinTab from "@/components/PsakDinTab";
import SearchPsakDinTab from "@/components/SearchPsakDinTab";
import UploadPsakDinTab from "@/components/UploadPsakDinTab";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [activeTab, setActiveTab] = useState("gemara");

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <SidebarInset className="flex flex-col">
          <AppHeader />
          
          {/* Main content area */}
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-4 md:p-6">
              {/* Mobile sidebar trigger */}
              <div className="md:hidden mb-4">
                <SidebarTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Menu className="h-4 w-4" />
                    <span>תפריט</span>
                  </Button>
                </SidebarTrigger>
              </div>

              {/* Content cards with luxurious styling */}
              <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
                {activeTab === "gemara" && <GemaraTab />}
                {activeTab === "psak-din" && <PsakDinTab />}
                {activeTab === "search" && <SearchPsakDinTab />}
                {activeTab === "upload" && <UploadPsakDinTab />}
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Index;
