import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { EmomStoreProvider } from "@/hooks/useEmomStore";
import Index from "./pages/Index";
import Calculator from "./pages/Calculator";
import Female from "./pages/Female";
import Auth from "./pages/Auth";
import Challenge from "./pages/Challenge";
import Challenges from "./pages/Challenges";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EmomStoreProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/female" element={<Female />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/challenge/:challengeId" element={<Challenge />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </EmomStoreProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
