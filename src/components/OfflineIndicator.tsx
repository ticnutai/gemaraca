import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Only show when offline
  if (isOnline) return null;

  return (
    <Badge
      variant="destructive"
      className="fixed bottom-4 left-4 z-[9999] gap-1.5 px-3 py-1.5 shadow-lg animate-pulse"
    >
      <WifiOff className="h-3.5 w-3.5" />
      ללא חיבור
    </Badge>
  );
}
