import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Scale, Search, Upload } from "lucide-react";

interface NavigationProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  return (
    <div className="w-full border-b border-border bg-card" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-6 flex-row-reverse">
          <h1 className="text-3xl font-bold text-foreground text-right">גמרא להלכה</h1>
          
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-auto">
            <TabsList className="bg-muted border border-border">
              <TabsTrigger 
                value="gemara" 
                className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                גמרא
              </TabsTrigger>
              <TabsTrigger 
                value="psak-din" 
                className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-primary" />
                </div>
                פסקי דין
              </TabsTrigger>
              <TabsTrigger 
                value="search" 
                className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Search className="w-4 h-4 text-primary" />
                </div>
                חיפוש
              </TabsTrigger>
              <TabsTrigger 
                value="upload" 
                className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-primary" />
                </div>
                העלאה
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Navigation;
