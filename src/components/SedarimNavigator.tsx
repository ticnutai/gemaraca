import { useState } from "react";
import { BookOpen, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEDARIM, getMasechtotBySeder, Masechet, MASECHTOT } from "@/lib/masechtotData";
import { toDafFormat } from "@/lib/hebrewNumbers";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";

interface SedarimNavigatorProps {
  className?: string;
}

const SedarimNavigator = ({ className }: SedarimNavigatorProps) => {
  const navigate = useNavigate();
  const { setSelectedMasechet, setActiveTab } = useAppContext();
  const [selectedSeder, setSelectedSeder] = useState<string | null>(null);
  const [selectedMasechetLocal, setSelectedMasechetLocal] = useState<Masechet | null>(null);

  const handleSederClick = (seder: string) => {
    if (selectedSeder === seder) {
      // Toggle off if clicking same seder
      setSelectedSeder(null);
      setSelectedMasechetLocal(null);
    } else {
      setSelectedSeder(seder);
      setSelectedMasechetLocal(null);
    }
  };

  const handleMasechetClick = (masechet: Masechet) => {
    if (selectedMasechetLocal?.englishName === masechet.englishName) {
      setSelectedMasechetLocal(null);
    } else {
      setSelectedMasechetLocal(masechet);
    }
  };

  const handleDafClick = (masechet: Masechet, dafNumber: number, amud: 'a' | 'b') => {
    const sugyaId = `${masechet.sefariaName.toLowerCase()}_${dafNumber}${amud}`;
    setSelectedMasechet(masechet.hebrewName);
    setActiveTab("gemara");
    navigate(`/sugya/${sugyaId}`);
  };

  const getMasechetCount = (seder: string) => {
    return getMasechtotBySeder(seder).length;
  };

  // Generate daf buttons for selected masechet
  const getDafButtons = () => {
    if (!selectedMasechetLocal) return null;

    const dafim = [];
    for (let daf = 2; daf <= selectedMasechetLocal.maxDaf; daf++) {
      dafim.push(daf);
    }

    return dafim;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 6 Sedarim Cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
        {SEDARIM.map((seder) => (
          <button
            key={seder}
            onClick={() => handleSederClick(seder)}
            className={cn(
              "p-3 md:p-4 rounded-xl border-2 transition-all duration-200 text-center",
              "hover:shadow-elegant hover:scale-[1.02]",
              selectedSeder === seder
                ? "bg-primary text-primary-foreground border-accent shadow-gold"
                : "bg-card border-border hover:border-accent/50"
            )}
          >
            <BookOpen className="h-5 w-5 md:h-6 md:w-6 mx-auto mb-1.5" />
            <span className="font-bold text-sm md:text-base block">{seder}</span>
            <span className="text-xs opacity-70">{getMasechetCount(seder)} מסכתות</span>
          </button>
        ))}
      </div>

      {/* Masechtot of Selected Seder */}
      {selectedSeder && (
        <div className="bg-card/50 rounded-xl border border-border p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-3">
            <button 
              onClick={() => setSelectedSeder(null)}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 rtl-flip" />
            </button>
            <h3 className="font-bold text-lg">סדר {selectedSeder}</h3>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {getMasechtotBySeder(selectedSeder).map((masechet) => (
              <Button
                key={masechet.englishName}
                variant={selectedMasechetLocal?.englishName === masechet.englishName ? "default" : "outline"}
                size="sm"
                onClick={() => handleMasechetClick(masechet)}
                className={cn(
                  "transition-all",
                  selectedMasechetLocal?.englishName === masechet.englishName && "shadow-gold"
                )}
              >
                {masechet.hebrewName}
                <span className="text-xs opacity-70 mr-1">({masechet.maxDaf})</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Dafim Grid of Selected Masechet */}
      {selectedMasechetLocal && (
        <div className="bg-card/50 rounded-xl border border-border p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-3">
            <button 
              onClick={() => setSelectedMasechetLocal(null)}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 rtl-flip" />
            </button>
            <h3 className="font-bold text-lg">מסכת {selectedMasechetLocal.hebrewName}</h3>
            <span className="text-sm text-muted-foreground">({selectedMasechetLocal.maxDaf - 1} דפים)</span>
          </div>
          
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
            {getDafButtons()?.map((daf) => (
              <div key={daf} className="flex flex-col gap-0.5">
                {/* Amud Alef */}
                <button
                  onClick={() => handleDafClick(selectedMasechetLocal, daf, 'a')}
                  className={cn(
                    "px-2 py-1.5 text-xs rounded-t-lg border border-b-0 transition-all",
                    "bg-card hover:bg-accent hover:text-accent-foreground",
                    "border-border hover:border-accent"
                  )}
                >
                  {toDafFormat(daf, 'a')}
                </button>
                {/* Amud Bet */}
                <button
                  onClick={() => handleDafClick(selectedMasechetLocal, daf, 'b')}
                  className={cn(
                    "px-2 py-1.5 text-xs rounded-b-lg border transition-all",
                    "bg-muted/50 hover:bg-accent hover:text-accent-foreground",
                    "border-border hover:border-accent"
                  )}
                >
                  {toDafFormat(daf, 'b')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SedarimNavigator;
