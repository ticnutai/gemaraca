import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SettingsButton } from "./SettingsButton";

const AppHeader = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/20 bg-primary shadow-lg">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Right side - Logo and title */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10 md:hidden" />
          <h1 className="text-2xl md:text-3xl font-bold text-accent tracking-wide">
            גמרא להלכה
          </h1>
        </div>

        {/* Left side - Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
