import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Link2, 
  Trash2, 
  Sparkles, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  X
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Stats {
  total: number;
  linked: number;
  duplicates: number;
  duplicatesByTitle?: number;
  duplicatesByHash?: number;
  unlinked: number;
}

const PsakDinStats = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-duplicates', {
        body: { action: 'stats' }
      });
      
      if (error) throw error;
      setStats(data.stats);
    } catch (err) {
      console.error("Error fetching stats:", err);
      toast({ title: "שגיאה בטעינת סטטיסטיקות", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCleanup = async () => {
    if (!confirm(`האם לנקות ${stats?.duplicates} כפולים?`)) return;
    
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-duplicates', {
        body: { action: 'cleanup' }
      });
      
      if (error) throw error;
      
      toast({ 
        title: `נמחקו ${data.deleted} כפולים`,
        description: "הנתונים התעדכנו"
      });
      
      await fetchStats();
    } catch (err) {
      console.error("Error cleaning:", err);
      toast({ title: "שגיאה בניקוי", variant: "destructive" });
    } finally {
      setCleaning(false);
    }
  };

  const [jobId, setJobId] = useState<string | null>(null);

  const handleBulkAnalysis = async () => {
    if (!confirm(`האם לנתח ${stats?.unlinked} פסקי דין שלא קושרו?\n\nהניתוח ירוץ ברקע - תוכל לעבור לטאבים אחרים.`)) return;
    
    setAnalyzing(true);
    try {
      // Start background job
      const { data, error } = await supabase.functions.invoke('bulk-analyze', {
        body: { action: 'start' }
      });
      
      if (error) throw error;
      
      setJobId(data.jobId);
      setAnalysisProgress({ current: 0, total: data.total });
      
      toast({ 
        title: "הניתוח התחיל ברקע",
        description: `מנתח ${data.total} פסקי דין - ניתן לעבור לטאבים אחרים`
      });
      
      // Start polling
      pollJobStatus(data.jobId);
      
    } catch (err) {
      console.error("Error starting bulk analysis:", err);
      toast({ title: "שגיאה בהתחלת הניתוח", variant: "destructive" });
      setAnalyzing(false);
    }
  };

  const pollJobStatus = async (currentJobId: string) => {
    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('bulk-analyze', {
          body: { action: 'status', jobId: currentJobId }
        });
        
        if (error) throw error;
        
        setAnalysisProgress({ 
          current: data.processed, 
          total: data.total 
        });
        
        if (data.status === 'completed') {
          setAnalyzing(false);
          setJobId(null);
          toast({ 
            title: "הניתוח הושלם",
            description: `${data.successful} הצליחו, ${data.failed} נכשלו`
          });
          await fetchStats();
        } else if (data.status === 'error' || data.status === 'cancelled') {
          setAnalyzing(false);
          setJobId(null);
          toast({ 
            title: data.status === 'cancelled' ? "הניתוח בוטל" : "שגיאה בניתוח",
            variant: "destructive"
          });
        } else {
          // Continue polling
          setTimeout(poll, 3000);
        }
      } catch (err) {
        console.error("Poll error:", err);
        setTimeout(poll, 5000);
      }
    };
    
    poll();
  };

  const cancelAnalysis = async () => {
    if (!jobId) return;
    
    try {
      await supabase.functions.invoke('bulk-analyze', {
        body: { action: 'cancel', jobId }
      });
      toast({ title: "מבטל..." });
    } catch (err) {
      console.error("Cancel error:", err);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            טוען סטטיסטיקות...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const linkedPercent = stats.total > 0 ? (stats.linked / stats.total) * 100 : 0;

  return (
    <Card className="mb-6" dir="rtl">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          סטטיסטיקות פסקי דין
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 mr-auto"
            onClick={fetchStats}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.total.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">סה"כ פסקי דין</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{stats.linked}</div>
            <div className="text-xs text-muted-foreground">מקושרים לסוגיות</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{stats.unlinked.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">לא מקושרים</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{stats.duplicates}</div>
            <div className="text-xs text-muted-foreground">
              כפולים
              {stats.duplicatesByTitle !== undefined && stats.duplicatesByHash !== undefined && (
                <span className="block text-[10px] mt-0.5">
                  ({stats.duplicatesByTitle} כותרת, {stats.duplicatesByHash} תוכן)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>קישור לסוגיות</span>
            <span>{linkedPercent.toFixed(1)}%</span>
          </div>
          <Progress value={linkedPercent} className="h-2" />
        </div>

        {/* Analysis Progress */}
        {analyzing && analysisProgress.total > 0 && (
          <div className="space-y-2 p-3 bg-primary/10 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-pulse" />
                מנתח ברקע (ניתן לעבור טאבים)
              </span>
              <span>{analysisProgress.current}/{analysisProgress.total}</span>
            </div>
            <Progress 
              value={(analysisProgress.current / analysisProgress.total) * 100} 
              className="h-2" 
            />
            <Button 
              variant="ghost" 
              size="sm"
              onClick={cancelAnalysis}
              className="text-xs text-destructive hover:text-destructive"
            >
              <X className="w-3 h-3 mr-1" />
              בטל ניתוח
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {stats.duplicates > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCleanup}
              disabled={cleaning}
              className="gap-2"
            >
              {cleaning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              נקה {stats.duplicates} כפולים
            </Button>
          )}
          
          {stats.unlinked > 0 && (
            <Button 
              variant="default" 
              size="sm"
              onClick={handleBulkAnalysis}
              disabled={analyzing}
              className="gap-2"
            >
              {analyzing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              נתח {stats.unlinked.toLocaleString()} לא מקושרים
            </Button>
          )}

          {stats.duplicates === 0 && stats.unlinked === 0 && (
            <div className="flex items-center gap-2 text-green-500 text-sm">
              <CheckCircle className="w-4 h-4" />
              כל הנתונים מסודרים!
            </div>
          )}
        </div>

        {/* Warning */}
        {stats.duplicates > 50 && (
          <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>יש הרבה כפולים. מומלץ לנקות לפני ניתוח AI.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PsakDinStats;
