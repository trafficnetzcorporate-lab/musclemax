/** Explain the failure without treating every server rejection as lost internet. */
export function challengeErrorMessage(error: unknown): string {
  const detail = typeof error === 'object' && error !== null
    ? error as { code?: string; message?: string; status?: number }
    : {};
  const message = typeof detail.message === 'string' ? detail.message.toLowerCase() : '';

  if (detail.status === 401 || ['PGRST301', 'PGRST302', 'PGRST303'].includes(detail.code || '') ||
      /authentication required|jwt expired|invalid jwt/.test(message)) {
    return 'Please sign in again to share your workout. Your workout is saved on this device.';
  }
  if (message.includes('session not found')) {
    return 'Your workout has not finished syncing yet. Please try again in a moment.';
  }
  if (!detail.code && /failed to fetch|fetch failed|networkerror|network request failed|load failed/.test(message)) {
    return 'Could not reach Muscle Max. Your workout is saved on this device. Check your connection and try again.';
  }
  return 'Could not create the challenge. Your workout is saved on this device. Please try again.';
}
