import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';
import { NATIVE_AUTH_REDIRECT } from './platform';
import type { OAuthProviderId } from '@/hooks/useAuth';

/**
 * Native OAuth (iOS): never run the provider's authorization page inside the
 * app WebView. We hand the provider URL to the system browser
 * (SFSafariViewController on iOS), and the provider returns to the app via
 * the custom scheme `com.jms.musclemax://auth-callback`, where the appUrlOpen
 * listener (see App.tsx) extracts the tokens and establishes the session.
 *
 * The pending Friend Challenge survives the round trip: mm_auth_redirect /
 * pending-challenge keys live in WebView storage, which is not touched by the
 * external browser.
 */
export async function signInWithOAuthNative(
  provider: Extract<OAuthProviderId, 'google' | 'apple'>,
): Promise<{ error: string | null; openedExternal: boolean }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_AUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) {
    return { error: error?.message ?? 'Sign-in failed', openedExternal: false };
  }
  try {
    await Browser.open({ url: data.url, presentationStyle: 'popover' });
    return { error: null, openedExternal: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not open sign-in', openedExternal: false };
  }
}

/**
 * Complete a native OAuth return. Parses access/refresh tokens from the deep
 * link (hash or query) and sets the Supabase session. Returns true when the
 * URL was an auth callback and a session was established.
 */
export async function completeNativeOAuth(url: string): Promise<boolean> {
  const withoutScheme = url.replace(/^[^:]+:\/\//, '');
  if (!withoutScheme.startsWith('auth-callback')) return false;
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const params = new URLSearchParams(hash || query);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  try { await Browser.close(); } catch { /* noop */ }
  if (!accessToken || !refreshToken) return false;
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return !error;
}
