import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Home, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MASECHTOT, SEDARIM, getMasechtotBySeder } from "@/lib/masechtotData";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";
import { cn } from "@/lib/utils";

type NavigationLevel = 'seder' | 'masechet' | 'daf' | 'amud';

interface FloatingGemaraNavProps {
  className?: string;
}

const FloatingGemaraNav = ({ className }: FloatingGemaraNavProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [level, setLevel] = useState<NavigationLevel>('seder');
  const [selectedSeder, setSelectedSeder] = useState<string | null>(null);
  const [selectedMasechet, setSelectedMasechet] = useState<typeof MASECHTOT[0] | null>(null);
  const [selectedDaf, setSelectedDaf] = useState<number | null>(null);

  const resetNavigation = () => {
    setLevel('seder');
    setSelectedSeder(null);
    setSelectedMasechet(null);
    setSelectedDaf(null);
  };

  const handleSederSelect = (seder: string) => {
    setSelectedSeder(seder);
    setLevel('masechet');
  };

  const handleMasechetSelect = (masechet: typeof MASECHTOT[0]) => {
    setSelectedMasechet(masechet);
    setLevel('daf');
  };

  const handleDafSelect = (daf: number) => {
    setSelectedDaf(daf);
    setLevel('amud');
  };

  const handleAmudSelect = (amud: 'a' | 'b') => {
    if (!selectedMasechet || !selectedDaf) return;
    
    const sugyaId = `${selectedMasechet.sefariaName.toLowerCase()}_${selectedDaf}${amud}`;
    navigate(`/sugya/${sugyaId}`);
    setIsOpen(false);
    resetNavigation();
  };

  const goBack = () => {
    switch (level) {
      case 'masechet':
        setLevel('seder');
        setSelectedSeder(null);
        break;
      case 'daf':
        setLevel('masechet');
        setSelectedMasechet(null);
        break;
      case 'amud':
        setLevel('daf');
        setSelectedDaf(null);
        break;
    }
  };

  const getTitle = () => {
    switch (level) {
      case 'seder': return 'סדרים';
      case 'masechet': return `מסכתות - ${selectedSeder}`;
      case 'daf': return `${selectedMasechet?.hebrewName} - דפים`;
      case 'amud': return `${selectedMasechet?.hebrewName} דף ${toHebrewNumeral(selectedDaf!)}`;
    }
  };

  // Generate daf buttons (2 to maxDaf)
  const getDafButtons = () => {
    if (!selectedMasechet) return [];
    const dafim = [];
    for (let i = 2; i <= selectedMasechet.maxDaf; i++) {
      dafim.push(i);
    }
    return dafim;
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "flex items-center justify-center",
          "hover:scale-110 transition-transform duration-200",
          "hover:shadow-xl",
          className
        )}
        aria-label="ניווט מהיר"
      >
        <BookOpen className="w-6 h-6" />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setIsOpen(false);
            resetNavigation();
          }}
        >
          {/* Modal Content */}
          <div 
            className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:rounded-2xl bg-card border border-border shadow-2xl z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
              <h2 className="text-xl font-bold text-foreground">{getTitle()}</h2>
              <div className="flex items-center gap-2">
                {level !== 'seder' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goBack}
                    className="gap-1"
                  >
                    חזרה
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={resetNavigation}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Home className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsOpen(false);
                    resetNavigation();
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="h-[60vh] md:h-[400px]">
              <div className="p-4">
                {/* Seder Level */}
                {level === 'seder' && (
                  <div className="grid grid-cols-2 gap-3">
                    {SEDARIM.map((seder) => (
                      <Button
                        key={seder}
                        variant="outline"
                        onClick={() => handleSederSelect(seder)}
                        className="h-14 text-lg font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        {seder}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Masechet Level */}
                {level === 'masechet' && selectedSeder && (
                  <div className="grid grid-cols-2 gap-3">
                    {getMasechtotBySeder(selectedSeder).map((masechet) => (
                      <Button
                        key={masechet.hebrewName}
                        variant="outline"
                        onClick={() => handleMasechetSelect(masechet)}
                        className="h-14 text-lg font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        {masechet.hebrewName}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Daf Level */}
                {level === 'daf' && selectedMasechet && (
                  <div className="grid grid-cols-5 gap-2" style={{ direction: 'rtl' }}>
                    {getDafButtons().map((daf) => (
                      <Button
                        key={daf}
                        variant="outline"
                        onClick={() => handleDafSelect(daf)}
                        className="h-12 text-base font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        {toHebrewNumeral(daf)}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Amud Level */}
                {level === 'amud' && selectedDaf && (
                  <div className="space-y-4">
                    <p className="text-center text-muted-foreground">
                      בחר עמוד
                    </p>
                    <div className="grid grid-cols-2 gap-4" style={{ direction: 'rtl' }}>
                      <Button
                        variant="outline"
                        onClick={() => handleAmudSelect('a')}
                        className="h-20 text-2xl font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        עמוד א׳
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleAmudSelect('b')}
                        className="h-20 text-2xl font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        עמוד ב׳
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer - Breadcrumb */}
            <div className="p-3 border-t border-border bg-muted/30 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedSeder && (
                  <>
                    <span 
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => {
                        setLevel('seder');
                        setSelectedSeder(null);
                        setSelectedMasechet(null);
                        setSelectedDaf(null);
                      }}
                    >
                      {selectedSeder}
                    </span>
                  </>
                )}
                {selectedMasechet && (
                  <>
                    <span>›</span>
                    <span 
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => {
                        setLevel('masechet');
                        setSelectedMasechet(null);
                        setSelectedDaf(null);
                      }}
                    >
                      {selectedMasechet.hebrewName}
                    </span>
                  </>
                )}
                {selectedDaf && (
                  <>
                    <span>›</span>
                    <span 
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => {
                        setLevel('daf');
                        setSelectedDaf(null);
                      }}
                    >
                      דף {toHebrewNumeral(selectedDaf)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingGemaraNav;
