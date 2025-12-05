import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Masechet } from "@/lib/masechtotData";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";

interface MasechetDownloaderProps {
  masechet: Masechet;
  loadedPages: number[];
  onComplete: () => void;
}

const MasechetDownloader = ({ masechet, loadedPages, onComplete }: MasechetDownloaderProps) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentDaf, setCurrentDaf] = useState<number | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const { toast } = useToast();

  const BATCH_SIZE = 5;
  const DELAY_BETWEEN_BATCHES = 1000; // ms

  const handleDownload = async () => {
    setDownloading(true);
    setCancelled(false);
    setProgress(0);

    // רשימת הדפים שצריך להוריד (מתחילים מדף ב')
    const allDafim = Array.from({ length: masechet.maxDaf - 1 }, (_, i) => i + 2);
    const dafimToLoad = allDafim.filter(daf => !loadedPages.includes(daf));

    if (dafimToLoad.length === 0) {
      toast({
        title: "כל הדפים כבר נטענו",
        description: `מסכת ${masechet.hebrewName} טעונה במלואה`,
      });
      setDownloading(false);
      return;
    }

    toast({
      title: "מתחיל הורדה",
      description: `מוריד ${dafimToLoad.length} דפים ממסכת ${masechet.hebrewName}`,
    });

    let successCount = 0;
    let failCount = 0;

    // טעינה בקבוצות
    for (let i = 0; i < dafimToLoad.length; i += BATCH_SIZE) {
      if (cancelled) break;

      const batch = dafimToLoad.slice(i, i + BATCH_SIZE);
      
      // טעינה מקבילית של הקבוצה
      const results = await Promise.allSettled(
        batch.map(async (dafNumber) => {
          if (cancelled) throw new Error('Cancelled');
          
          setCurrentDaf(dafNumber);
          const hebrewNumber = toHebrewNumeral(dafNumber);
          const sugya_id = `${masechet.sefariaName.toLowerCase()}_${dafNumber}a`;
          const title = `${masechet.hebrewName} דף ${hebrewNumber}`;

          const { error } = await supabase.functions.invoke('load-daf', {
            body: { 
              dafNumber, 
              sugya_id, 
              title,
              masechet: masechet.hebrewName
            }
          });

          if (error) throw error;
          return dafNumber;
        })
      );

      // עדכון מונים
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
        }
      });

      // עדכון אחוז התקדמות
      const totalProcessed = i + batch.length;
      setProgress((totalProcessed / dafimToLoad.length) * 100);

      // המתנה בין קבוצות
      if (i + BATCH_SIZE < dafimToLoad.length && !cancelled) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    setDownloading(false);
    setCurrentDaf(null);
    setProgress(100);
    onComplete();

    toast({
      title: cancelled ? "ההורדה בוטלה" : "ההורדה הושלמה",
      description: `נטענו ${successCount} דפים${failCount > 0 ? `, ${failCount} נכשלו` : ''}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  const handleCancel = () => {
    setCancelled(true);
  };

  const unloadedCount = (masechet.maxDaf - 1) - loadedPages.length;

  if (unloadedCount === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-2">
        ✓ כל הדפים טעונים
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {downloading ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {currentDaf ? `טוען דף ${toHebrewNumeral(currentDaf)}...` : 'מכין...'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-7 w-7 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-center text-muted-foreground">
            {Math.round(progress)}%
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4" />
          הורד מסכת שלמה ({unloadedCount} דפים)
        </Button>
      )}
    </div>
  );
};

export default MasechetDownloader;
