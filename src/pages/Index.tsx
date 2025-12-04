import { useState } from "react";
import Navigation from "@/components/Navigation";
import GemaraTab from "@/components/GemaraTab";
import PsakDinTab from "@/components/PsakDinTab";
import SearchPsakDinTab from "@/components/SearchPsakDinTab";
import UploadPsakDinTab from "@/components/UploadPsakDinTab";

const Index = () => {
  const [activeTab, setActiveTab] = useState("gemara");

  return (
    <div className="min-h-screen bg-background">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      {activeTab === "gemara" && <GemaraTab />}
      {activeTab === "psak-din" && <PsakDinTab />}
      {activeTab === "search" && <SearchPsakDinTab />}
      {activeTab === "upload" && <UploadPsakDinTab />}
    </div>
  );
};

export default Index;
