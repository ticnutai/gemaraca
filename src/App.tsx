import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsButton } from "./components/SettingsButton";
import GlobalUploadProgress from "./components/GlobalUploadProgress";
import GlobalDownloadProgress from "./components/GlobalDownloadProgress";
import AppLayout from "./components/AppLayout";
import { AppContextProvider } from "./contexts/AppContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy-loaded route pages (code splitting)
const Index = lazy(() => import("./pages/Index"));
const SugyaDetail = lazy(() => import("./pages/SugyaDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContextProvider>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <SettingsButton />
            <GlobalUploadProgress />
            <GlobalDownloadProgress />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<AppLayout><Index /></AppLayout>} />
              <Route path="/sugya/:id" element={<AppLayout><SugyaDetail /></AppLayout>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AppContextProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
