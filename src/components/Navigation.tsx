import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Scale, Search } from "lucide-react";

interface NavigationProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  return (
    <div className="w-full border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-6">
          <h1 className="text-3xl font-bold text-foreground">גמרא להלכה</h1>
          
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-auto">
            <TabsList className="bg-muted border border-border">
              <TabsTrigger 
                value="gemara" 
                className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <BookOpen className="w-4 h-4" />
                גמרא
              </TabsTrigger>
              <TabsTrigger 
                value="psak-din" 
                className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <Scale className="w-4 h-4" />
                פסקי דין
              </TabsTrigger>
              <TabsTrigger 
                value="search" 
                className="gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <Search className="w-4 h-4" />
                חיפוש פסקי דין
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Navigation;
