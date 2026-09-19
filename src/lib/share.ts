/**
 * Modular sharing. The surface here is intentionally thin so the native iOS
 * share sheet replaces the implementation without touching the challenge data
 * model. All URLs come from PUBLIC_APP_URL — never the native scheme — so
 * shared challenge links always open for any recipient.
 */

import { Share } from '@capacitor/share';
import { isNative, publicChallengeUrl } from './platform';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export function canNativeShare(): boolean {
  return isNative() || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
}

export async function shareChallenge(payload: SharePayload): Promise<'shared' | 'copied' | 'failed'> {
  if (isNative()) {
    try {
      await Share.share({ title: payload.title, text: payload.text, url: payload.url, dialogTitle: payload.title });
      return 'shared';
    } catch {
      /* user dismissed — fall through to copy */
    }
  } else if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch {
      /* user dismissed or unsupported — fall through to copy */
    }
  }
  return (await copyLink(payload.url)) ? 'copied' : 'failed';
}

export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/** Absolute public challenge URL — same shape used by iOS Universal Links. */
export function challengeUrl(challengeId: string): string {
  return publicChallengeUrl(challengeId);
}
