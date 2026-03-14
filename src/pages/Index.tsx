import { lazy, Suspense } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

// Lazy-loaded tab components (code splitting)
const SedarimNavigator = lazy(() => import("@/components/SedarimNavigator"));
const PsakDinTab = lazy(() => import("@/components/PsakDinTab"));
const SearchPsakDinTab = lazy(() => import("@/components/SearchPsakDinTab"));
const UploadPsakDinTab = lazy(() => import("@/components/UploadPsakDinTab"));
const SmartIndexTab = lazy(() => import("@/components/SmartIndexTab"));
const AdvancedIndexTab = lazy(() => import("@/components/AdvancedIndexTab"));
const DownloadManagerTab = lazy(() => import("@/components/DownloadManagerTab"));

const TabFallback = () => (
  <div className="p-3 md:p-6 space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-32 w-full" />
  </div>
);

const Index = () => {
  const { activeTab } = useAppContext();
  const isMobile = useIsMobile();

  // On mobile, hide SedarimNavigator when another tab is active to save space
  const showNavigator = !isMobile || activeTab === "gemara";

  return (
    <div className="p-2 md:p-6 space-y-3 md:space-y-4 max-w-full" data-active-tab={activeTab}>
      {/* Sedarim Navigator - lazy loaded, hidden on mobile when non-gemara tab active */}
      {showNavigator && (
        <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
          <SedarimNavigator />
        </Suspense>
      )}

      {/* Content cards - only show for non-gemara tabs */}
      {activeTab !== "gemara" && (
        <div className="bg-card rounded-xl md:rounded-2xl shadow-lg border border-border/50 overflow-hidden">
          <Suspense fallback={<TabFallback />}>
            {activeTab === "psak-din" && <PsakDinTab />}
            {activeTab === "smart-index" && <SmartIndexTab />}
            {activeTab === "search" && <SearchPsakDinTab />}
            {activeTab === "upload" && <UploadPsakDinTab />}
            {activeTab === "download" && <DownloadManagerTab />}
            {activeTab === "advanced-index" && <AdvancedIndexTab />}
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default Index;
