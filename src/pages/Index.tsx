import GemaraTab from "@/components/GemaraTab";
import PsakDinTab from "@/components/PsakDinTab";
import SearchPsakDinTab from "@/components/SearchPsakDinTab";
import UploadPsakDinTab from "@/components/UploadPsakDinTab";
import SmartIndexTab from "@/components/SmartIndexTab";
import SedarimNavigator from "@/components/SedarimNavigator";
import { useAppContext } from "@/contexts/AppContext";

const Index = () => {
  const { activeTab, selectedMasechet, setSelectedMasechet } = useAppContext();

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Sedarim Navigator - 6 frames at top */}
      <SedarimNavigator />

      {/* Content cards with luxurious styling */}
      <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
        {activeTab === "gemara" && (
          <GemaraTab 
            selectedMasechet={selectedMasechet}
            onMasechetChange={(masechet) => setSelectedMasechet(masechet)}
          />
        )}
        {activeTab === "psak-din" && <PsakDinTab />}
        {activeTab === "smart-index" && <SmartIndexTab />}
        {activeTab === "search" && <SearchPsakDinTab />}
        {activeTab === "upload" && <UploadPsakDinTab />}
      </div>
    </div>
  );
};

export default Index;
