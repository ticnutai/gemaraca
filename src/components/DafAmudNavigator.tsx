import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MASECHTOT, Masechet } from "@/lib/masechtotData";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";

interface DafAmudNavigatorProps {
  masechet?: string;
  currentDaf?: number;
  currentAmud?: 'a' | 'b';
  className?: string;
}

const DafAmudNavigator = ({ 
  masechet: propMasechet, 
  currentDaf: propDaf, 
  currentAmud: propAmud,
  className = ""
}: DafAmudNavigatorProps) => {
  const navigate = useNavigate();
  const { id } = useParams();

  // Parse current location from URL id
  const parsedLocation = useMemo(() => {
    if (!id) return null;
    
    // Try to parse sugya_id format: masechet_dafAmud (e.g., "bava_metzia_22a")
    const match = id.match(/^(.+?)_(\d+)([ab])$/);
    if (match) {
      const sefariaName = match[1];
      const daf = parseInt(match[2]);
      const amud = match[3] as 'a' | 'b';
      
      // Find masechet by sefaria name
      const masechetData = MASECHTOT.find(m => 
        m.sefariaName.toLowerCase() === sefariaName.toLowerCase() ||
        m.sefariaName.toLowerCase().replace(/_/g, '_') === sefariaName.toLowerCase()
      );
      
      return { masechet: masechetData, daf, amud };
    }
    
    return null;
  }, [id]);

  const masechetData = useMemo(() => {
    if (propMasechet) {
      return MASECHTOT.find(m => 
        m.sefariaName === propMasechet || 
        m.hebrewName === propMasechet ||
        m.englishName === propMasechet
      );
    }
    return parsedLocation?.masechet;
  }, [propMasechet, parsedLocation]);

  const currentDaf = propDaf || parsedLocation?.daf || 2;
  const currentAmud = propAmud || parsedLocation?.amud || 'a';
  const maxDaf = masechetData?.maxDaf || 176;

  // Navigate to a specific daf/amud
  const navigateTo = (daf: number, amud: 'a' | 'b') => {
    if (!masechetData) return;
    
    const sugyaId = `${masechetData.sefariaName.toLowerCase()}_${daf}${amud}`;
    navigate(`/sugya/${sugyaId}`);
  };

  // Previous amud (if on amud b, go to amud a. If on amud a, go to previous daf amud b)
  const goToPrevAmud = () => {
    if (currentAmud === 'b') {
      navigateTo(currentDaf, 'a');
    } else if (currentDaf > 2) {
      navigateTo(currentDaf - 1, 'b');
    }
  };

  // Next amud (if on amud a, go to amud b. If on amud b, go to next daf amud a)
  const goToNextAmud = () => {
    if (currentAmud === 'a') {
      navigateTo(currentDaf, 'b');
    } else if (currentDaf < maxDaf) {
      navigateTo(currentDaf + 1, 'a');
    }
  };

  // Previous daf (same amud)
  const goToPrevDaf = () => {
    if (currentDaf > 2) {
      navigateTo(currentDaf - 1, currentAmud);
    }
  };

  // Next daf (same amud)
  const goToNextDaf = () => {
    if (currentDaf < maxDaf) {
      navigateTo(currentDaf + 1, currentAmud);
    }
  };

  // Check if navigation is possible
  const canGoPrevAmud = currentAmud === 'b' || currentDaf > 2;
  const canGoNextAmud = currentAmud === 'a' || currentDaf < maxDaf;
  const canGoPrevDaf = currentDaf > 2;
  const canGoNextDaf = currentDaf < maxDaf;

  if (!masechetData) {
    return null;
  }

  const hebrewDaf = toHebrewNumeral(currentDaf);
  const amudLabel = currentAmud === 'a' ? 'א' : 'ב';

  return (
    <div className={`bg-card border border-border rounded-xl shadow-sm ${className}`} dir="rtl">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Right side - Amud navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevAmud}
            disabled={!canGoPrevAmud}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 px-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-bold text-foreground min-w-[60px] text-center">
              עמוד {amudLabel}
            </span>
            <span className="w-2 h-2 rounded-full bg-primary" />
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextAmud}
            disabled={!canGoNextAmud}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Center - Current location */}
        <div className="text-center px-4">
          <span className="text-lg font-bold text-primary">
            {masechetData.hebrewName} דף {hebrewDaf} עמוד {amudLabel}
          </span>
        </div>

        {/* Left side - Daf navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevDaf}
            disabled={!canGoPrevDaf}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 px-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="font-bold text-foreground min-w-[50px] text-center">
              דף {hebrewDaf}
            </span>
            <span className="w-2 h-2 rounded-full bg-accent" />
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextDaf}
            disabled={!canGoNextDaf}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-b-xl overflow-hidden">
        <div 
          className="h-full bg-gradient-to-l from-accent to-primary transition-all duration-300"
          style={{ 
            width: `${((currentDaf - 2 + (currentAmud === 'b' ? 0.5 : 0)) / (maxDaf - 2 + 0.5)) * 100}%` 
          }}
        />
      </div>
    </div>
  );
};

export default DafAmudNavigator;
