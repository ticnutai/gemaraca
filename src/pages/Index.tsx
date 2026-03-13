import PsakDinTab from "@/components/PsakDinTab";
import SearchPsakDinTab from "@/components/SearchPsakDinTab";
import UploadPsakDinTab from "@/components/UploadPsakDinTab";
import SmartIndexTab from "@/components/SmartIndexTab";
import AdvancedIndexTab from "@/components/AdvancedIndexTab";
import DownloadManagerTab from "@/components/DownloadManagerTab";
import SedarimNavigator from "@/components/SedarimNavigator";
import { useAppContext } from "@/contexts/AppContext";

const Index = () => {
  const { activeTab } = useAppContext();

  return (
    <div className="p-2 md:p-6 space-y-3 md:space-y-4 overflow-x-hidden max-w-full">
      {/* Sedarim Navigator - 6 frames at top */}
      <SedarimNavigator />

      {/* Content cards - only show for non-gemara tabs */}
      {activeTab !== "gemara" && (
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
          {activeTab === "psak-din" && <PsakDinTab />}
          {activeTab === "smart-index" && <SmartIndexTab />}
          {activeTab === "search" && <SearchPsakDinTab />}
          {activeTab === "upload" && <UploadPsakDinTab />}
          {activeTab === "download" && <DownloadManagerTab />}
          {activeTab === "advanced-index" && <AdvancedIndexTab />}
        </div>
      )}
    </div>
  );
};

export default Index;
