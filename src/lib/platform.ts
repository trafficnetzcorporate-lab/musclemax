import { Capacitor } from '@capacitor/core';

/**
 * Platform + public-URL configuration.
 *
 * PUBLIC_APP_URL is the app's own public HTTPS origin — the canonical home of
 * the /challenge/:id pages and the target for email-confirmation redirects and
 * OAuth returns. It is NEVER the Capacitor scheme and never a preview URL, and
 * it is shaped exactly like the future Universal Links
 * (`{PUBLIC_APP_URL}/challenge/:id`).
 *
 * Override with VITE_PUBLIC_APP_URL at build time when the permanent custom
 * domain is ready; until then it falls back to the published Lovable URL.
 *
 * SHARE_LINK_ORIGIN is the link-preview service used only for SHARED Friend
 * Challenge links. It renders the rich preview (challenger name, score, score
 * card) in iMessage/WhatsApp/X and then forwards to this app's real
 * `{PUBLIC_APP_URL}/challenge/:id` page. Old /challenge/:id links keep working
 * forever — the share origin is purely a presentation layer in front of them.
 */
export const PUBLIC_APP_URL: string =
  (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://musclemax.lovable.app';

/**
 * Link-preview service origin for shared Friend Challenge links. Recipients
 * see a rich card (name, score, score card) and are forwarded to this app's
 * /challenge/:id page. The app's own routes are unchanged.
 */
export const SHARE_LINK_ORIGIN = 'https://muscle-max-challenge-cards.lovable.app';

/** True when running inside the native iOS shell (Capacitor WKWebView). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Custom URL scheme the native app registers for auth/callback deep links. */
export const NATIVE_AUTH_SCHEME = 'com.jms.musclemax';
export const NATIVE_AUTH_REDIRECT = `${NATIVE_AUTH_SCHEME}://auth-callback`;

/**
 * Shareable challenge URL. Points at the link-preview service (`/c/:id`), which
 * renders the rich card and forwards to this app's `/challenge/:id` page. The
 * in-app route and old `{PUBLIC_APP_URL}/challenge/:id` links are untouched.
 */
export function publicChallengeUrl(challengeId: string): string {
  return `${SHARE_LINK_ORIGIN}/c/${challengeId}`;
}

/**
 * Redirect target for email confirmation / password reset. On web it's the
 * current origin; on native it's the public URL (Universal Links route it back
 * into the app once Associated Domains are configured).
 */
export function emailRedirectUrl(): string {
  return isNative() ? PUBLIC_APP_URL : window.location.origin;
}
