import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { ACCOUNT_STORAGE_KEYS, deleteAccountAndClearLocalData } from '../../src/lib/account-deletion';

function fixture() {
  const saved = new Map<string, string>([
    ...ACCOUNT_STORAGE_KEYS.map(key => [key, 'private workout or account data'] as [string, string]),
    ['theme', 'dark'],
    ['another_app_profile', 'unrelated data'],
    ['sb-other-project-auth-token', 'unrelated session'],
  ]);
  const queryClient = new QueryClient();
  queryClient.setQueryData(['profile', 'deleted-user'], { name: 'Former athlete' });
  queryClient.getMutationCache().build(queryClient, { mutationKey: ['private-workout'] });
  let profile = { name: 'Former athlete', workoutCount: 42 };
  const events: string[] = [];
  const options = {
    requestDeletion: async () => { events.push('server-deleted'); return { data: { deleted: true }, error: null }; },
    signOut: async () => { events.push('signed-out'); },
    clearQueryCache: () => { events.push('queries-cleared'); queryClient.clear(); },
    resetProfile: () => { events.push('profile-reset'); profile = { name: 'Athlete', workoutCount: 0 }; },
    storage: { removeItem: (key: string) => { events.push(`removed:${key}`); saved.delete(key); } },
  };
  return { saved, queryClient, events, options, profile: () => profile };
}

test('confirmed deletion removes every known app key, both query caches, and the in-memory profile', async () => {
  const f = fixture();
  await deleteAccountAndClearLocalData(f.options);
  for (const key of ACCOUNT_STORAGE_KEYS) assert.equal(f.saved.has(key), false, key);
  assert.equal(f.queryClient.getQueryCache().getAll().length, 0);
  assert.equal(f.queryClient.getMutationCache().getAll().length, 0);
  assert.deepEqual(f.profile(), { name: 'Athlete', workoutCount: 0 });
  assert.deepEqual(f.events.slice(0, 4), ['server-deleted', 'signed-out', 'queries-cleared', 'profile-reset']);
  assert.deepEqual([...f.saved], [
    ['theme', 'dark'], ['another_app_profile', 'unrelated data'], ['sb-other-project-auth-token', 'unrelated session'],
  ]);
});

test('server errors and unconfirmed responses preserve all local records and do not sign out', async () => {
  const responses = [
    { data: null, error: { message: 'Server unavailable' } },
    { data: { deleted: false }, error: null },
    { data: null, error: null },
    { data: { deleted: true }, error: { message: 'Incomplete deletion' } },
  ];
  for (const response of responses) {
    const f = fixture();
    const before = [...f.saved];
    await assert.rejects(deleteAccountAndClearLocalData({ ...f.options, requestDeletion: async () => response }));
    assert.deepEqual([...f.saved], before);
    assert.deepEqual(f.events, []);
    assert.equal(f.profile().workoutCount, 42);
    assert.equal(f.queryClient.getQueryCache().getAll().length, 1);
    assert.equal(f.queryClient.getMutationCache().getAll().length, 1);
  }
});

test('a rejected server request preserves guest/account data without any cleanup', async () => {
  const f = fixture();
  const before = [...f.saved];
  await assert.rejects(deleteAccountAndClearLocalData({ ...f.options, requestDeletion: async () => { throw new Error('Offline'); } }), /Offline/);
  assert.deepEqual([...f.saved], before);
  assert.deepEqual(f.events, []);
});

test('local cleanup still runs after a sign-out exception, with an accurate partial-cleanup message', async () => {
  const f = fixture();
  await assert.rejects(deleteAccountAndClearLocalData({ ...f.options, signOut: async () => { throw new Error('Sign-out failed'); } }), /account was deleted/);
  for (const key of ACCOUNT_STORAGE_KEYS) assert.equal(f.saved.has(key), false);
  assert.equal(f.queryClient.getQueryCache().getAll().length, 0);
  assert.equal(f.profile().workoutCount, 0);
});

test('one failed storage removal does not skip other keys or cache cleanup', async () => {
  const f = fixture();
  await assert.rejects(deleteAccountAndClearLocalData({
    ...f.options,
    storage: { removeItem: key => {
      if (key === 'emom_profile') throw new Error('Storage unavailable');
      f.saved.delete(key);
    } },
  }), /could not finish clearing/);
  assert.equal(f.saved.has('emom_leg_logs'), false);
  assert.equal(f.saved.has('mm_auth_redirect'), false);
  assert.equal(f.saved.has('mm_pending_challenge'), false);
  assert.equal(f.saved.get('theme'), 'dark');
  assert.equal(f.queryClient.getQueryCache().getAll().length, 0);
  assert.equal(f.profile().workoutCount, 0);
});
