import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsButton } from "./components/SettingsButton";
import GlobalUploadProgress from "./components/GlobalUploadProgress";
import AppLayout from "./components/AppLayout";
import { AppContextProvider } from "./contexts/AppContext";

// Direct imports
import Index from "./pages/Index";
import SugyaDetail from "./pages/SugyaDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContextProvider>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/sugya/:id" element={<SugyaDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </AppContextProvider>
        </BrowserRouter>
        <SettingsButton />
        <GlobalUploadProgress />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
