import { Button } from "@/components/ui/button";
import { BookOpen, Search } from "lucide-react";
import DafQuickNav from "./DafQuickNav";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-4 py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/5" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utb3BhY2l0eT0iMC4wOCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <h1 className="text-7xl md:text-9xl font-bold tracking-tight leading-tight">
            <span className="inline-block bg-gradient-to-l from-primary via-accent to-primary bg-clip-text text-transparent drop-shadow-2xl">
              גמרא להלכה
            </span>
          </h1>
          
          <div className="h-1 w-32 mx-auto bg-gradient-to-r from-transparent via-accent to-transparent rounded-full shadow-gold"></div>
          
          <div className="flex flex-wrap items-center justify-center gap-6 pt-8">
            <Button 
              size="lg" 
              className="gap-2 shadow-elegant hover:shadow-gold transition-all text-lg px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 border border-accent/20"
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
