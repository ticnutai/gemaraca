import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SugyaDetail from "./pages/SugyaDetail";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsButton } from "./components/SettingsButton";
import GlobalUploadProgress from "./components/GlobalUploadProgress";
import AppLayout from "./components/AppLayout";
import { AppContextProvider } from "./contexts/AppContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContextProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/*"
                element={
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/sugya/:id" element={<SugyaDetail />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                }
              />
            </Routes>
          </AppContextProvider>
        </BrowserRouter>
        <SettingsButton />
        <GlobalUploadProgress />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
