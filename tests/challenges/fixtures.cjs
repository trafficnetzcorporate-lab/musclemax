// Invented data and transport boundaries for the isolated challenge UI test.
const session = {
  id: 'challenge-ui-session-fixture',
  date: '2026-09-25T12:00:00.000Z',
  exerciseId: 'regular_pushup',
  phase: 'standard',
  sets: Array.from({ length: 10 }, (_, index) => ({
    setNumber: index + 1,
    targetReps: index === 9 ? -1 : 8,
    actualReps: 8,
    isAmrap: index === 9,
  })),
  totalReps: 80,
};
const challengeId = '00000000-0000-4000-8000-000000000082';

const mocks = {
  'src/hooks/useAuth.tsx': `
    const user = { id: 'challenge-ui-user-fixture' };
    const profile = { name: 'Local Test Athlete' };
    export const useAuth = () => ({ user, profile, loading: false, signOut: async () => {} });
    export const setPostAuthRedirect = () => {};
  `,
  'src/hooks/useEmomStore.ts': `
    const profile = {
      name: 'Local Test Athlete', level: 2, totalXp: 150, streak: 1,
      unlockedExercises: ['regular_pushup'],
      exerciseProgress: {
        regular_pushup: {
          exerciseId: 'regular_pushup', currentPhase: 'standard',
          currentPrescription: [8, 8, 8, 8, 8, 8, 8, 8, 8, -1],
          totalWorkouts: 1, bestTotalReps: 90, history: [], mastered: false, xp: 50,
        },
      },
    };
    export const useEmomStore = () => ({
      profile, syncing: false,
      getExerciseProgress: id => profile.exerciseProgress[id] || null,
      completeWorkout: session => window.__challengeTest.completed.push(session),
      unlockExercise: () => {}, applyChallengeWin: () => {},
      applyChallengePartial: () => {}, resetProfile: () => {},
    });
  `,
  'src/lib/emom-sync.ts': `
    export const pushSession = (userId, session) => {
      const state = window.__challengeTest;
      state.calls.push(['upload', userId, session]);
      return new Promise((resolve, reject) => { state.upload = { resolve, reject }; });
    };
  `,
  'src/integrations/supabase/client.ts': `
    export const supabase = {
      rpc: (name, args) => {
        const state = window.__challengeTest;
        state.calls.push(['rpc', name, args]);
        if (name === 'get_public_challenge') return Promise.resolve({ error: null, data: [{
          id: '${challengeId}', creator_display_name: 'Canonical Test Athlete',
          exercise_id: 'regular_pushup', format: '10-minute-emom',
          prescription: Array(10).fill(8), creator_total_reps: 83,
          parent_challenge_id: null, created_at: '2026-09-25T12:00:00.000Z', attempt_count: 0,
        }] });
        if (name !== 'create_challenge_from_session') throw new Error('Unexpected RPC: ' + name);
        return new Promise((resolve, reject) => { state.rpc = { resolve, reject }; });
      },
    };
  `,
  'src/components/emom/EmomTimer.tsx': `
    import React from 'react';
    export default function TimerFixture({ onComplete }) {
      return React.createElement('button', { onClick: () => onComplete(${JSON.stringify(session)}) }, 'Complete fixture workout');
    }
  `,
};

module.exports = { session, challengeId, mocks };
