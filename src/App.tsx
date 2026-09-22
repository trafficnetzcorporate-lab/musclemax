import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { AuthProvider, takePostAuthRedirect } from "@/hooks/useAuth";
import { EmomStoreProvider } from "@/hooks/useEmomStore";
import { NATIVE_AUTH_SCHEME } from "@/lib/platform";
import { completeNativeOAuth } from "@/lib/native-auth";
import Index from "./pages/Index";
import Calculator from "./pages/Calculator";
import EmomRate from "./pages/EmomRate";
import Female from "./pages/Female";
import Auth from "./pages/Auth";
import Challenge from "./pages/Challenge";
import Challenges from "./pages/Challenges";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * Handles links arriving from outside the app on iOS:
 *  - Universal Links (https://PUBLIC_APP_URL/challenge/:id) → route into the app.
 *  - Custom-scheme auth callback (com.jms.musclemax://auth-callback#tokens) →
 *    establish the session, then navigate to the preserved destination
 *    (e.g. the pending Friend Challenge).
 * Universal Links require the Associated Domains entitlement + hosted AASA file
 * (see public/.well-known/apple-app-site-association); the custom scheme is
 * registered in Xcode → Info → URL Types → "musclemax" scheme.
 */
function NativeLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const route = (url: string) => {
      if (url.startsWith(`${NATIVE_AUTH_SCHEME}://`)) {
        completeNativeOAuth(url).then((signedIn) => {
          if (signedIn) {
            const dest = takePostAuthRedirect();
            navigate(dest || '/', { replace: true });
          }
        });
        return;
      }
      // Universal Link / https deep link — route by pathname + query.
      try {
        const u = new URL(url);
        if (u.pathname !== '/') {
          navigate(u.pathname + u.search, { replace: false });
        }
      } catch { /* ignore malformed URLs */ }
    };

    CapApp.addListener('appUrlOpen', ({ url }) => route(url)).catch(() => { /* noop */ });
    CapApp.getLaunchUrl().then(({ url }) => { if (url) route(url); }).catch(() => { /* noop */ });

    return () => {
      CapApp.removeAllListeners().catch(() => { /* noop */ });
    };
  }, [navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EmomStoreProvider>
            <NativeLinkHandler />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/rate" element={<EmomRate />} />
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
