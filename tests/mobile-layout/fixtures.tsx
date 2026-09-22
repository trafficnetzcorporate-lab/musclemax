/**
 * Isolated browser layout fixtures. All athlete/session/challenge values below
 * are invented test data. Nothing imports this module from the production app.
 * The test browser must block external requests, especially Supabase requests
 * made by ShareChallengeDialog. Its explicit fallback props render the fixture.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import WorkoutSummary from '@/components/emom/WorkoutSummary';
import ChallengeResultCard from '@/components/emom/ChallengeResultCard';
import ShareChallengeDialog from '@/components/emom/ShareChallengeDialog';
import WorkoutHistory from '@/components/emom/WorkoutHistory';
import WeeklyProgressChart from '@/components/emom/WeeklyProgressChart';
import EmomTimer from '@/components/emom/EmomTimer';
import EmomRateCalculator from '@/components/emom/EmomRateCalculator';
import type { ExerciseProgress, ExerciseVariation, WorkoutSession } from '@/types/emom';

const noOp = () => {};
const longAthleteName = 'Alexandria Montgomery-Wellington SupercalifragilisticAthlete';
const longExerciseId: ExerciseVariation = 'freestanding_handstand_pushup';
const nextPrescription = [12, 12, 11, 11, 10, 10, 9, 9, 8, -1];

function makeSession(index: number, exerciseId: ExerciseVariation = longExerciseId): WorkoutSession {
  const sets = Array.from({ length: 10 }, (_, setIndex) => ({
    setNumber: setIndex + 1,
    targetReps: setIndex === 9 ? -1 : Math.max(6, 12 - Math.floor(setIndex / 2)),
    actualReps: setIndex === 9 ? 13 + (index % 5) : Math.max(5, 10 - Math.floor(setIndex / 3) + (index % 3)),
    isAmrap: setIndex === 9,
  }));
  return {
    id: `layout-fixture-${exerciseId}-${index}`,
    date: new Date(Date.UTC(2026, 6, 12 + index * 7, 12)).toISOString(),
    exerciseId,
    phase: 'standard',
    sets,
    totalReps: sets.reduce((total, set) => total + set.actualReps, 0),
    notes: 'Invented data used exclusively for responsive layout verification.',
  };
}

function makeProgress(exerciseId: ExerciseVariation): ExerciseProgress {
  const history = Array.from({ length: 10 }, (_, index) => makeSession(index, exerciseId));
  return {
    exerciseId,
    currentPhase: 'standard',
    currentPrescription: nextPrescription,
    totalWorkouts: history.length,
    bestTotalReps: Math.max(...history.map(session => session.totalReps)),
    history,
    mastered: false,
    xp: 875,
  };
}

const progress = makeProgress(longExerciseId);
const session = progress.history[9];
const previousSession = progress.history[8];
const chartExercises: ExerciseVariation[] = [
  longExerciseId,
  'stomach_wall_handstand_pushup',
  'pseudo_planche_pushup',
  'neutral_grip_pullup',
  'typewriter_pullup',
  'front_lever_pullup',
];
const chartProgress = Object.fromEntries(chartExercises.map(id => [id, makeProgress(id)]));

const summaryProps = {
  session,
  previousSession,
  xpEarned: 125,
  isMastery: false,
  isPR: false,
  nextPrescription,
  onContinue: noOp,
  onChallengeFriend: noOp,
  challengePending: false,
} satisfies React.ComponentProps<typeof WorkoutSummary>;

const timerProps = {
  exerciseId: longExerciseId,
  phase: 'standard',
  prescription: nextPrescription,
  onComplete: noOp,
  onCancel: noOp,
} satisfies React.ComponentProps<typeof EmomTimer>;

// Exercise the actual pre-start timer UI while preventing a layout-only test
// from starting audio, a wake lock, or an active workout through a stray click.
function TimerFixture({ isChallenge = false }: { isChallenge?: boolean }) {
  const blockWorkoutStart: React.MouseEventHandler<HTMLDivElement> = event => {
    const button = (event.target as Element).closest('button');
    if (button?.textContent?.trim().toLowerCase() === 'start') {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  return (
    <div data-testid="timer-prestart" onClickCapture={blockWorkoutStart}>
      <EmomTimer {...timerProps} isChallenge={isChallenge} />
    </div>
  );
}

const fixtures: Record<string, React.ReactNode> = {
  'rate-observed': <EmomRateCalculator exerciseId={longExerciseId} history={progress.history} />,
  summary: <WorkoutSummary {...summaryProps} />,
  'summary-pr': <WorkoutSummary {...summaryProps} isPR />,
  'summary-mastery': <WorkoutSummary {...summaryProps} isMastery xpEarned={625} />,
  'challenge-result': (
    <ChallengeResultCard
      displayName={longAthleteName}
      exerciseId={longExerciseId}
      totalReps={137}
    />
  ),
  'share-dialog': (
    <ShareChallengeDialog
      challengeId="00000000-0000-4000-8000-000000000001"
      fallbackName={longAthleteName}
      fallbackExerciseId={longExerciseId}
      fallbackReps={137}
      onClose={noOp}
    />
  ),
  history: <WorkoutHistory exerciseId={longExerciseId} progress={progress} />,
  'weekly-chart': <WeeklyProgressChart exerciseProgress={chartProgress} />,
  timer: <TimerFixture />,
  'timer-challenge': <TimerFixture isChallenge />,
};

const requestedCase = new URLSearchParams(window.location.search).get('case') || 'summary';
const caseName = Object.prototype.hasOwnProperty.call(fixtures, requestedCase) ? requestedCase : 'unknown';

function LayoutFixture() {
  return (
    <main
      data-testid="layout-fixture"
      data-case={caseName}
      className="min-h-dvh min-w-0 max-w-lg mx-auto p-4 bg-background [overflow-wrap:anywhere]"
    >
      <p data-testid="fixture-label" className="mb-4 text-xs leading-relaxed text-muted-foreground">
        Layout fixture · {requestedCase} · invented test data
      </p>
      {caseName === 'unknown' ? (
        <p role="alert">Unknown fixture. Available cases: {Object.keys(fixtures).join(', ')}.</p>
      ) : fixtures[caseName]}
    </main>
  );
}

createRoot(document.getElementById('fixture-root')!).render(<LayoutFixture />);
