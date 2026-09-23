// These keys belong to Muscle Max. Never clear all storage: the same origin can
// also contain unrelated preferences or another app's data.
export const ACCOUNT_STORAGE_KEYS = [
  'emom_profile',
  'emom_leg_logs',
  'mm_auth_redirect',
  'mm_pending_challenge',
] as const;

interface AccountDeletionOptions {
  requestDeletion: () => Promise<{
    data: { deleted?: boolean } | null;
    error: { message?: string } | null;
  }>;
  signOut: () => Promise<void>;
  clearQueryCache: () => void;
  resetProfile: () => void;
  storage: Pick<Storage, 'removeItem'>;
}

/** Keep the local workout data intact unless the server confirms deletion. */
export async function deleteAccountAndClearLocalData({
  requestDeletion, signOut, clearQueryCache, resetProfile, storage,
}: AccountDeletionOptions): Promise<void> {
  const { data, error } = await requestDeletion();
  if (error || data?.deleted !== true) {
    throw new Error(error?.message || 'Deletion failed');
  }

  // Sign out first, so resetting the profile cannot sync a new guest profile
  // back to the deleted account. Supabase clears its own session and PKCE keys.
  // Still attempt every local cleanup step if one of them fails.
  const failures: unknown[] = [];
  try {
    await signOut();
  } catch (error) {
    failures.push(error);
  }
  for (const cleanup of [
    clearQueryCache,
    resetProfile,
    ...ACCOUNT_STORAGE_KEYS.map(key => () => storage.removeItem(key)),
  ]) {
    try {
      cleanup();
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length) {
    throw new Error('Your account was deleted, but this device could not finish clearing its saved data. Close and reopen the app.');
  }
}
