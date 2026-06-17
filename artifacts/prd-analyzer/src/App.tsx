import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AnalysisDetail from "@/pages/analysis";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return <>{children}</>;
}

function Router() {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-14 flex items-center">
          <div className="flex items-center gap-2 font-mono font-bold text-sm text-foreground">
            <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full"></div>
            </div>
            PRD_GAP_ANALYZER
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/analyses/:id" component={AnalysisDetail} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
