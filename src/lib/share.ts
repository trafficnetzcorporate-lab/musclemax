/**
 * Modular sharing. The surface here is intentionally thin so a native iOS share
 * sheet can replace the implementation without touching the challenge data model.
 */

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function shareChallenge(payload: SharePayload): Promise<'shared' | 'copied' | 'failed'> {
  if (canNativeShare()) {
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

/** Absolute challenge URL. Same path shape is used for future iOS Universal Links. */
export function challengeUrl(challengeId: string): string {
  return `${window.location.origin}/challenge/${challengeId}`;
}
