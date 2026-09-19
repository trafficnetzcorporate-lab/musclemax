import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { isNative, emailRedirectUrl } from '@/lib/platform';
import { signInWithOAuthNative } from '@/lib/native-auth';

/**
 * Provider-agnostic auth layer.
 * Application data is always keyed off `user.id` (the stable account id) — never off
 * any provider-specific identity field — so new providers (e.g. Apple during the iOS
 * conversion) can be added by extending OAuthProviderId only.
 */
export type OAuthProviderId = 'google' | 'apple' | 'microsoft';

export interface AppProfile {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AppProfile | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithProvider: (provider: OAuthProviderId) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REDIRECT_KEY = 'mm_auth_redirect';

/** Remember where the user was headed (same-origin path only). */
export function setPostAuthRedirect(path: string) {
  if (path.startsWith('/') && !path.startsWith('//')) {
    localStorage.setItem(REDIRECT_KEY, path);
  }
}

export function takePostAuthRedirect(): string | null {
  const p = localStorage.getItem(REDIRECT_KEY);
  localStorage.removeItem(REDIRECT_KEY);
  return p && p.startsWith('/') && !p.startsWith('//') ? p : null;
}

export function peekPostAuthRedirect(): string | null {
  const p = localStorage.getItem(REDIRECT_KEY);
  return p && p.startsWith('/') && !p.startsWith('//') ? p : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, name, username, avatar_url, created_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      setProfile({
        userId: data.user_id,
        name: data.name,
        username: data.username,
        avatarUrl: data.avatar_url,
        createdAt: data.created_at,
      });
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      if (newSession?.user) {
        // Defer: never call other supabase functions inside the callback.
        setTimeout(() => loadProfile(newSession.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) loadProfile(data.session.user.id);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Public HTTPS URL on native (Universal Links route it back into the app);
        // current origin on web.
        emailRedirectTo: emailRedirectUrl(),
        data: { display_name: displayName || 'Athlete' },
      },
    });
    if (error) return { error: error.message, needsConfirmation: false };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }, []);

  const signInWithProvider = useCallback(async (provider: OAuthProviderId) => {
    // Native iOS: system browser + custom-scheme return — never the OAuth page
    // inside the WebView. Web: the Lovable managed OAuth flow.
    if (isNative() && (provider === 'google' || provider === 'apple')) {
      const result = await signInWithOAuthNative(provider);
      return { error: result.error };
    }
    const result = await lovable.auth.signInWithOAuth(provider as never, {
      redirect_uri: emailRedirectUrl(),
    });
    if (result.error) return { error: result.error.message || 'Sign-in failed' };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signUpWithEmail, signInWithEmail, signInWithProvider, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
