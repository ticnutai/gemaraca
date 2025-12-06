import { BookOpen, Scale, Search, Upload } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  {
    id: "gemara",
    title: "גמרא",
    icon: BookOpen,
    description: "לימוד מסכתות ודפים",
  },
  {
    id: "psak-din",
    title: "פסקי דין",
    icon: Scale,
    description: "צפייה בפסקי דין",
  },
  {
    id: "search",
    title: "חיפוש פסקי דין",
    icon: Search,
    description: "חיפוש במאגר",
  },
  {
    id: "upload",
    title: "העלאה",
    icon: Upload,
    description: "העלאת מסמכים",
  },
];

const AppSidebar = ({ activeTab, onTabChange }: AppSidebarProps) => {
  return (
    <Sidebar side="right" className="border-l border-border/50">
      <SidebarHeader className="border-b border-border/50 p-4">
        <h2 className="text-lg font-semibold text-foreground">ניווט ראשי</h2>
        <p className="text-sm text-muted-foreground">בחר קטגוריה</p>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs mb-2">
            תפריט
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onTabChange(item.id)}
                    isActive={activeTab === item.id}
                    tooltip={item.description}
                    className={`
                      group relative rounded-xl py-3 px-4 transition-all duration-200
                      ${activeTab === item.id 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "hover:bg-secondary/80 text-foreground"
                      }
                    `}
                  >
                    <item.icon className={`h-5 w-5 ${activeTab === item.id ? "text-accent" : "text-muted-foreground group-hover:text-foreground"}`} />
                    <span className="font-medium">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
