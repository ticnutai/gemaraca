import { useState, useEffect } from "react";
import { BookOpen, ChevronLeft, ChevronDown, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEDARIM, getMasechtotBySeder, Masechet } from "@/lib/masechtotData";
import { toDafFormat } from "@/lib/hebrewNumbers";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";

interface SedarimNavigatorProps {
  className?: string;
}

interface PsakDinExample {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
}

const SedarimNavigator = ({ className }: SedarimNavigatorProps) => {
  const navigate = useNavigate();
  const { setSelectedMasechet, setActiveTab } = useAppContext();
  const [selectedSeder, setSelectedSeder] = useState<string | null>(null);
  const [selectedMasechetLocal, setSelectedMasechetLocal] = useState<Masechet | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [psakDinExamples, setPsakDinExamples] = useState<PsakDinExample[]>([]);

  const INITIAL_DAF_COUNT = 20;

  // Load sample Psakei Din
  useEffect(() => {
    const loadPsakDinExamples = async () => {
      const { data } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, summary')
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (data) {
        setPsakDinExamples(data);
      }
    };
    loadPsakDinExamples();
  }, []);

  const handleSederClick = (seder: string) => {
    if (selectedSeder === seder) {
      setSelectedSeder(null);
      setSelectedMasechetLocal(null);
    } else {
      setSelectedSeder(seder);
      setSelectedMasechetLocal(null);
      setIsExpanded(false);
    }
  };

  const handleMasechetClick = (masechet: Masechet) => {
    if (selectedMasechetLocal?.englishName === masechet.englishName) {
      setSelectedMasechetLocal(null);
    } else {
      setSelectedMasechetLocal(masechet);
      setIsExpanded(false);
    }
  };

  const handleDafClick = (masechet: Masechet, dafNumber: number, amud: 'a' | 'b') => {
    const sugyaId = `${masechet.sefariaName.toLowerCase()}_${dafNumber}${amud}`;
    setSelectedMasechet(masechet.hebrewName);
    setActiveTab("gemara");
    navigate(`/sugya/${sugyaId}`);
  };

  const handlePsakDinClick = (id: string) => {
    setActiveTab("psak-din");
    // Could navigate to specific psak din view
  };

  const getMasechetCount = (seder: string) => {
    return getMasechtotBySeder(seder).length;
  };

  // Generate daf list for selected masechet
  const getAllDafim = () => {
    if (!selectedMasechetLocal) return [];
    const dafim = [];
    for (let daf = 2; daf <= selectedMasechetLocal.maxDaf; daf++) {
      dafim.push(daf);
    }
    return dafim;
  };

  const allDafim = getAllDafim();
  const displayedDafim = isExpanded ? allDafim : allDafim.slice(0, INITIAL_DAF_COUNT);
  const remainingCount = allDafim.length - INITIAL_DAF_COUNT;

  return (
    <div className={cn("space-y-4 md:space-y-6", className)}>
      {/* Spacing from header */}
      <div className="pt-3 md:pt-4" />

      {/* 6 Sedarim Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
        {SEDARIM.map((seder) => (
          <button
            key={seder}
            onClick={() => handleSederClick(seder)}
            className={cn(
              "p-2.5 md:p-4 rounded-xl border-2 transition-all duration-200 text-center",
              "hover:shadow-elegant hover:scale-[1.02]",
              selectedSeder === seder
                ? "bg-primary text-primary-foreground border-accent shadow-gold"
                : "bg-card border-border hover:border-accent/50"
            )}
          >
            <BookOpen className="h-4 w-4 md:h-6 md:w-6 mx-auto mb-1" />
            <span className="font-bold text-xs md:text-base block">{seder}</span>
            <span className="text-[10px] md:text-xs opacity-70">{getMasechetCount(seder)} מסכתות</span>
          </button>
        ))}
      </div>

      {/* Masechtot of Selected Seder */}
      {selectedSeder && (
        <div className="bg-card/50 rounded-xl border border-border p-3 md:p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-3">
            <button 
              onClick={() => setSelectedSeder(null)}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 rtl-flip" />
            </button>
            <h3 className="font-bold text-base md:text-lg">סדר {selectedSeder}</h3>
          </div>
          
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {getMasechtotBySeder(selectedSeder).map((masechet) => (
              <Button
                key={masechet.englishName}
                variant={selectedMasechetLocal?.englishName === masechet.englishName ? "default" : "outline"}
                size="sm"
                onClick={() => handleMasechetClick(masechet)}
                className={cn(
                  "transition-all text-xs md:text-sm h-8 md:h-9 px-2 md:px-3",
                  selectedMasechetLocal?.englishName === masechet.englishName && "shadow-gold"
                )}
              >
                {masechet.hebrewName}
                <span className="text-[10px] md:text-xs opacity-70 mr-1">({masechet.maxDaf})</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Dafim Grid of Selected Masechet - Golden buttons like reference image */}
      {selectedMasechetLocal && (
        <div className="bg-card rounded-xl border border-border p-3 md:p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <button 
              onClick={() => setSelectedMasechetLocal(null)}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 rtl-flip" />
            </button>
            <h3 className="font-bold text-base md:text-lg">מסכת {selectedMasechetLocal.hebrewName}</h3>
            <span className="text-xs md:text-sm text-muted-foreground">({selectedMasechetLocal.maxDaf - 1} דפים)</span>
          </div>
          
          {/* Dafim grid with golden buttons */}
          <div className="flex flex-wrap gap-1.5 md:gap-2 p-2 md:p-3 rounded-lg bg-secondary/30">
            {displayedDafim.map((daf) => (
              <button
                key={daf}
                onClick={() => handleDafClick(selectedMasechetLocal, daf, 'a')}
                className={cn(
                  "px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm rounded-lg transition-all",
                  "min-w-[40px] md:min-w-[52px] font-medium",
                  "bg-accent text-accent-foreground",
                  "hover:brightness-110 hover:shadow-md",
                  "active:scale-95"
                )}
              >
                {toDafFormat(daf, 'a').replace(" ע\"א", "").replace("׳", "'")}
              </button>
            ))}
          </div>

          {/* Expand button */}
          {!isExpanded && remainingCount > 0 && (
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-1 mt-3 md:mt-4 mx-auto text-xs md:text-sm text-accent hover:text-accent/80 transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
              <span>הרחב ({remainingCount} נוספים)</span>
            </button>
          )}
          
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1 mt-3 md:mt-4 mx-auto text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
              <span>צמצם</span>
            </button>
          )}
        </div>
      )}

      {/* Psak Din Examples Section */}
      {psakDinExamples.length > 0 && !selectedMasechetLocal && (
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Scale className="h-4 w-4 md:h-5 md:w-5 text-accent" />
            <h3 className="font-bold text-base md:text-lg">דוגמאות פסקי דין</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {psakDinExamples.map((psak) => (
              <button
                key={psak.id}
                onClick={() => handlePsakDinClick(psak.id)}
                className={cn(
                  "p-2.5 md:p-3 rounded-lg border text-right transition-all",
                  "bg-secondary/30 border-border hover:border-accent hover:shadow-sm",
                  "hover:bg-accent/10"
                )}
              >
                <h4 className="font-medium text-xs md:text-sm line-clamp-2 mb-1">{psak.title}</h4>
                <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
                  <span>{psak.court}</span>
                  <span>•</span>
                  <span>{psak.year}</span>
                </div>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setActiveTab("psak-din")}
            className="flex items-center gap-1 mt-3 md:mt-4 mx-auto text-xs md:text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <span>צפה בכל פסקי הדין</span>
            <ChevronLeft className="h-4 w-4 rtl-flip" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SedarimNavigator;
