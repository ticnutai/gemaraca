import { Button } from "@/components/ui/button";
import { BookOpen, Search } from "lucide-react";
import DafQuickNav from "./DafQuickNav";

const Hero = () => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center px-4 py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5" />
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">מערכת לימוד תורה מתקדמת</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-l from-primary via-secondary to-primary bg-clip-text text-transparent">
              מגשרים בין התורה
            </span>
            <br />
            <span className="text-foreground">למציאות המודרנית</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            חבר בין סוגיות הגמרא בדפים א-ל של מסכת בבא מציעא לפסקי דין ומקרים מעשיים מהחיים האמיתיים. 
            למד כיצד העקרונות הגמראיים של מציאה, אבידה ושמירה מיושמים בפועל בבתי המשפט ובחיי היום-יום.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button 
              size="lg" 
              className="gap-2 shadow-lg hover:shadow-xl transition-all"
              onClick={() => document.getElementById('sugyot')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <BookOpen className="w-5 h-5" />
              עיין בסוגיות
            </Button>
            <DafQuickNav />
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
