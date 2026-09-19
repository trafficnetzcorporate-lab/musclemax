import { Capacitor } from '@capacitor/core';

/**
 * Platform + public-URL configuration.
 *
 * PUBLIC_APP_URL is the single source of truth for every link that leaves the
 * app (Friend Challenge links, email-confirmation redirects, OAuth returns).
 * It is ALWAYS a public HTTPS origin — never the Capacitor scheme and never a
 * preview URL — so shared links work for any recipient and are shaped exactly
 * like the future Universal Links (`{PUBLIC_APP_URL}/challenge/:id`).
 *
 * Override with VITE_PUBLIC_APP_URL at build time when the permanent custom
 * domain is ready; until then it falls back to the published Lovable URL.
 */
export const PUBLIC_APP_URL: string =
  (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://musclemax.lovable.app';

/** True when running inside the native iOS shell (Capacitor WKWebView). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Custom URL scheme the native app registers for auth/callback deep links. */
export const NATIVE_AUTH_SCHEME = 'com.jms.musclemax';
export const NATIVE_AUTH_REDIRECT = `${NATIVE_AUTH_SCHEME}://auth-callback`;

/** Absolute public challenge URL. Identical shape for web share + Universal Links. */
export function publicChallengeUrl(challengeId: string): string {
  return `${PUBLIC_APP_URL}/challenge/${challengeId}`;
}

/**
 * Redirect target for email confirmation / password reset. On web it's the
 * current origin; on native it's the public URL (Universal Links route it back
 * into the app once Associated Domains are configured).
 */
export function emailRedirectUrl(): string {
  return isNative() ? PUBLIC_APP_URL : window.location.origin;
}
