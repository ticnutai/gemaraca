import { useEffect } from "react";
import GemaraTab from "@/components/GemaraTab";
import PsakDinTab from "@/components/PsakDinTab";
import SearchPsakDinTab from "@/components/SearchPsakDinTab";
import UploadPsakDinTab from "@/components/UploadPsakDinTab";
import { useAppContext } from "@/contexts/AppContext";

const Index = () => {
  const { activeTab, selectedMasechet, setSelectedMasechet } = useAppContext();

  return (
    <div className="p-4 md:p-6">
      {/* Content cards with luxurious styling */}
      <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
        {activeTab === "gemara" && (
          <GemaraTab 
            selectedMasechet={selectedMasechet}
            onMasechetChange={(masechet) => setSelectedMasechet(masechet)}
          />
        )}
        {activeTab === "psak-din" && <PsakDinTab />}
        {activeTab === "search" && <SearchPsakDinTab />}
        {activeTab === "upload" && <UploadPsakDinTab />}
      </div>
    </div>
  );
};

export default Index;
