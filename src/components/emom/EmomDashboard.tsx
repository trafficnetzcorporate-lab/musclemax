import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { deleteAccountAndClearLocalData } from '@/lib/account-deletion';
import { useEmomStore } from '@/hooks/useEmomStore';
import { useAuth, setPostAuthRedirect } from '@/hooks/useAuth';
import { getExerciseById, ALL_EXERCISES, getDependents } from '@/lib/exercises';
import { ExerciseVariation, LEVEL_THRESHOLDS, WorkoutSession, XP_REWARDS } from '@/types/emom';
import { processWorkout, calculateWorkoutXp, getBaselinePrescription, evenOutReps } from '@/lib/emom-algorithm';
import { MAX_REPS_PER_SET } from '@/lib/emom-limits';
import { pushSession } from '@/lib/emom-sync';
import { createChallengeFromSession } from '@/lib/challenges';
import { challengeErrorMessage } from '@/lib/challenge-errors';
import { toast } from 'sonner';
import EmomTimer from './EmomTimer';
import SkillTree from './SkillTree';
import WorkoutHistory from './WorkoutHistory';
import WorkoutSummary from './WorkoutSummary';
import LegSection from './LegSection';
import WeeklyProgressChart from './WeeklyProgressChart';
import ShareChallengeDialog from './ShareChallengeDialog';
import { Link, useNavigate } from 'react-router-dom';
import {
  Flame, Trophy, Target, TrendingUp, Dumbbell,
  ArrowLeft, Shield, Calculator, Swords, Lock,
  LogIn, LogOut, Trash2
} from 'lucide-react';


type View = 'dashboard' | 'exercise' | 'workout' | 'summary';

// Minimum total reps in a Challenge to at least unlock the exercise (and earlier
// tiers) for logging. A full 12×10 = 120 additionally masters it + unlocks the next tier.
const CHALLENGE_UNLOCK_MIN = 60;

interface SummaryData {
  session: WorkoutSession;
  previousSession: WorkoutSession | null;
  xpEarned: number;
  isMastery: boolean;
  isPR: boolean;
  nextPrescription: number[];
}

export default function EmomDashboard() {
  const { profile, getExerciseProgress, completeWorkout, unlockExercise, applyChallengeWin, applyChallengePartial, resetProfile, syncing } = useEmomStore();
  const { user, profile: authProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>('dashboard');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'push' | 'pull' | 'legs'>('push');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [challengeMode, setChallengeMode] = useState(false);
  const [shareChallengeId, setShareChallengeId] = useState<string | null>(null);
  const [challengePending, setChallengePending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccountAndClearLocalData({
        requestDeletion: () => supabase.functions.invoke('delete-account'),
        signOut,
        clearQueryCache: () => queryClient.clear(),
        resetProfile,
        storage: localStorage,
      });
      toast.success('Account deleted. Thanks for training with us.');
      navigate('/auth', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete account');
    } finally {
      setDeleting(false);
    }
  };




  const nextLevelXp = LEVEL_THRESHOLDS[Math.min(profile.level, LEVEL_THRESHOLDS.length - 1)] || 99999;
  const prevLevelXp = LEVEL_THRESHOLDS[Math.max(profile.level - 2, 0)] || 0;
  const levelProgress = ((profile.totalXp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100;

  const totalMastered = Object.values(profile.exerciseProgress).filter(p => p.mastered).length;
  const totalWorkouts = Object.values(profile.exerciseProgress).reduce((s, p) => s + p.totalWorkouts, 0);

  const handleSelectExercise = (id: string) => {
    setSelectedExercise(id);
    setView('exercise');
  };

  const handleStartWorkout = () => {
    if (!selectedExercise) return;
    setChallengeMode(false);
    setView('workout');
  };

  const handleStartChallenge = () => {
    if (!selectedExercise) return;
    setChallengeMode(true);
    setView('workout');
  };

  const handleCompleteChallenge = (session: WorkoutSession) => {
    const totalReps = session.sets.reduce((s, set) => s + (set.actualReps || 0), 0);
    const maxed = session.sets.length === 10 && session.sets.every(s => (s.actualReps ?? 0) >= 12);
    const info = getExerciseById(session.exerciseId);
    setChallengeMode(false);

    // Full clear (12×10): master it AND unlock the next tier.
    if (maxed) {
      const isFirstMilestone = !getExerciseProgress(session.exerciseId)?.mastered;
      const unlockedNames = getDependents(session.exerciseId).map(e => e.name);
      applyChallengeWin(session);
      setSummaryData({
        session,
        previousSession: null,
        xpEarned: XP_REWARDS.COMPLETE_WORKOUT + (isFirstMilestone ? XP_REWARDS.MASTER_EXERCISE : 0),
        isMastery: isFirstMilestone,
        isPR: true,
        nextPrescription: evenOutReps(totalReps),
      });
      toast.success(`${info?.name} challenge cleared!`, {
        description: unlockedNames.length
          ? `Mastered. Unlocked: ${unlockedNames.join(', ')}. Earlier tiers are open for logging.`
          : 'Mastered. Earlier tiers are open for logging.',
      });
      setView('summary');
      return;
    }

    // Partial (≥60 reps): unlock this exercise + earlier tiers for logging.
    if (totalReps >= CHALLENGE_UNLOCK_MIN) {
      applyChallengePartial(session.exerciseId);
      toast.success(`${info?.name} unlocked!`, {
        description: `${totalReps} reps — strong enough to unlock ${info?.name} and every earlier tier for logging. Clear 12×10 to master it and open the next tier.`,
      });
      setView('exercise');
      return;
    }

    // Under 60: nothing unlocks.
    toast.error('Challenge not cleared', {
      description: `You got ${totalReps} reps. You need ${CHALLENGE_UNLOCK_MIN}+ to unlock this exercise, or 12 on all 10 sets to master it. Try again when you're ready.`,
    });
    setView('exercise');
  };

  const handleCompleteWorkout = (session: WorkoutSession) => {
    const progress = getExerciseProgress(session.exerciseId);
    if (!progress) return;

    // Calculate summary data BEFORE completing
    const { nextPrescription, nextPhase } = processWorkout(session, progress);
    const isMastery = nextPhase === 'completed' && !progress.mastered;
    const xpEarned = calculateWorkoutXp(session, isMastery);
    const totalReps = session.sets.reduce((s, set) => s + (set.actualReps || 0), 0);
    const isPR = totalReps > progress.bestTotalReps;
    const previousSession = progress.history.length > 0 ? progress.history[progress.history.length - 1] : null;

    setSummaryData({
      session,
      previousSession,
      xpEarned,
      isMastery,
      isPR,
      nextPrescription,
    });

    // Now complete the workout
    completeWorkout(session);

    // Check unlocks
    if (isMastery) {
      ALL_EXERCISES
        .filter(e => e.prerequisiteId === session.exerciseId)
        .forEach(e => unlockExercise(e.id));
    }

    setView('summary');
  };

  // Friend Challenge: publish the just-completed workout as an immutable challenge.
  const handleChallengeFriend = async () => {
    if (!summaryData) return;
    const { session } = summaryData;
    if (!user) {
      // Remember the intent so the challenge is created right after sign-in.
      localStorage.setItem('mm_pending_challenge', session.id);
      setPostAuthRedirect('/');
      navigate('/auth');
      return;
    }
    setChallengePending(true);
    try {
      await pushSession(user.id, session);
      const id = await createChallengeFromSession(session.id);
      setShareChallengeId(id);
    } catch (error) {
      toast.error(challengeErrorMessage(error));
    } finally {
      setChallengePending(false);
    }
  };

  // Resume a pending Friend Challenge after the user comes back from sign-in.
  useEffect(() => {
    if (!user) return;
    const pending = localStorage.getItem('mm_pending_challenge');
    if (!pending) return;
    localStorage.removeItem('mm_pending_challenge');
    (async () => {
      // The session sync (merge on sign-in) may still be in flight — retry briefly.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const id = await createChallengeFromSession(pending);
          setShareChallengeId(id);
          return;
        } catch {
          if (attempt === 2) toast.error('Could not create your challenge — open the workout summary and tap Challenge a Friend again.');
          else await new Promise(r => setTimeout(r, 2500));
        }
      }
    })();
  }, [user]);


  // The summary returns early, so keep sharing available in every dashboard view.
  const shareDialog = (
    <ShareChallengeDialog
      challengeId={shareChallengeId}
      fallbackName={authProfile?.name || profile.name}
      fallbackExerciseId={summaryData?.session.exerciseId ?? 'regular_pushup'}
      fallbackReps={summaryData ? summaryData.session.sets.reduce((s, st) => s + (st.actualReps || 0), 0) : 0}
      onClose={() => setShareChallengeId(null)}
    />
  );

  const selectedProgress = selectedExercise ? getExerciseProgress(selectedExercise) : null;

  const selectedInfo = selectedExercise ? getExerciseById(selectedExercise) : null;
  const selectedUnlocked = selectedExercise ? profile.unlockedExercises.includes(selectedExercise as ExerciseVariation) : false;

  // --- SUMMARY VIEW ---
  if (view === 'summary' && summaryData) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
        {shareDialog}
        <WorkoutSummary
          session={summaryData.session}
          previousSession={summaryData.previousSession}
          xpEarned={summaryData.xpEarned}
          isMastery={summaryData.isMastery}
          isPR={summaryData.isPR}
          nextPrescription={summaryData.nextPrescription}
          onContinue={() => {
            setSummaryData(null);
            setView('exercise');
          }}
          onChallengeFriend={handleChallengeFriend}
          challengePending={challengePending}
        />
      </div>
    );
  }


  // --- WORKOUT VIEW (also handles Challenge, including on locked exercises) ---
  if (view === 'workout' && selectedExercise && selectedInfo) {
    // A challenge is always an all-out 12×10 attempt, regardless of saved phase.
    const timerPhase = challengeMode ? 'baseline' : (selectedProgress?.currentPhase ?? 'baseline');
    const timerPrescription = challengeMode
      ? Array(10).fill(12)
      : (timerPhase === 'baseline' ? getBaselinePrescription() : selectedProgress?.currentPrescription ?? getBaselinePrescription());
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
        {shareDialog}
        <Button variant="ghost" size="sm" onClick={() => setView('exercise')} className="mb-4 min-h-11 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <EmomTimer
          exerciseId={selectedExercise as ExerciseVariation}
          phase={timerPhase}
          prescription={timerPrescription}
          isChallenge={challengeMode}
          onComplete={challengeMode ? handleCompleteChallenge : handleCompleteWorkout}
          onCancel={() => setView('exercise')}
        />
      </div>
    );
  }

  // --- LOCKED EXERCISE DETAIL VIEW (challenge-to-unlock) ---
  if (view === 'exercise' && selectedExercise && selectedInfo && !selectedUnlocked) {
    const prereq = selectedInfo.prerequisiteId ? getExerciseById(selectedInfo.prerequisiteId) : null;
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
        {shareDialog}
        <Button variant="ghost" size="sm" onClick={() => setView('dashboard')} className="mb-4 min-h-11 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <div className="text-center mb-6">
          <span className="text-5xl">{selectedInfo.icon}</span>
          <div className="flex items-start justify-center gap-2 mt-3">
            <Lock className="w-4 h-4 shrink-0 mt-1.5 text-muted-foreground" />
            <h2 className="min-w-0 break-words text-2xl leading-tight font-bold text-foreground">{selectedInfo.name}</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground mt-2">{selectedInfo.description}</p>
        </div>

        <Card className="border-primary/40 mb-4">
          <CardContent className="p-4 text-center">
            <Swords className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground mb-1">Challenge to unlock</p>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              Normally unlocked by mastering {prereq ? prereq.name : 'its prerequisite'}. Skip the grind in one
              all-out session:
            </p>
            <div className="text-left text-sm leading-relaxed text-muted-foreground mb-4 space-y-3">
              <p>
                <span className="text-primary font-bold">{CHALLENGE_UNLOCK_MIN}+ total reps</span> — unlocks this
                exercise and every earlier tier for normal logging.
              </p>
              <p>
                <span className="text-primary font-bold">12 reps × all 10 sets</span> — masters it outright and
                also unlocks the next tier.
              </p>
            </div>
            <Button onClick={handleStartChallenge} className="w-full min-h-12 h-auto py-3 whitespace-normal bg-primary text-primary-foreground gap-2">
              <Swords className="w-4 h-4" /> Start Challenge
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Under {CHALLENGE_UNLOCK_MIN} reps unlocks nothing — you can retry anytime.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- EXERCISE DETAIL VIEW ---
  if (view === 'exercise' && selectedExercise && selectedProgress && selectedInfo) {
    const phaseDescriptions: Record<string, string> = {
      baseline: `Find your capacity, up to ${MAX_REPS_PER_SET} reps per set. The timer beeps every minute.`,
      standard: `Hit your targets on sets 1-9, then AMRAP on set 10. Log up to ${MAX_REPS_PER_SET} reps in any set.`,
      completed: `12×10 milestone earned. Keep training toward ${MAX_REPS_PER_SET} reps across all 10 sets.`,
    };

    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
        {shareDialog}
        <Button variant="ghost" size="sm" onClick={() => setView('dashboard')} className="mb-4 min-h-11 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        {/* Exercise Header */}
        <div className="text-center mb-6">
          <span className="text-5xl">{selectedInfo.icon}</span>
          <h2 className="break-words text-2xl leading-tight font-bold text-foreground mt-3">{selectedInfo.name}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground mt-2">{selectedInfo.description}</p>
        </div>

        {/* Current Phase */}
        <Card className="border-primary/30 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words text-sm font-semibold text-foreground capitalize">
                {selectedProgress.currentPhase === 'completed' ? 'Milestone earned' : selectedProgress.currentPhase.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground mb-4">
              {phaseDescriptions[selectedProgress.currentPhase]}
            </p>

              <>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,2.75rem),1fr))] gap-1.5 mb-4">
                  {(selectedProgress.currentPhase === 'baseline' ? getBaselinePrescription() : selectedProgress.currentPrescription).map((reps, i) => (
                    <div
                      key={i}
                      aria-label={`Set ${i + 1}: ${selectedProgress.currentPhase !== 'baseline' && i === 9 ? 'AMRAP' : `${reps} reps`}`}
                      className={`min-w-0 text-center rounded py-2 text-sm font-mono font-bold tabular-nums ${
                        selectedProgress.currentPhase !== 'baseline' && i === 9
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      {selectedProgress.currentPhase !== 'baseline' && i === 9 ? '🔥' : reps}
                    </div>
                  ))}
                </div>
                <Button onClick={handleStartWorkout} className="w-full min-h-12 h-auto py-3 whitespace-normal bg-primary text-primary-foreground gap-2">
                  <Flame className="w-4 h-4" /> Start Workout
                </Button>
                <Button onClick={handleStartChallenge} variant="outline" className="w-full min-h-12 h-auto mt-2 py-3 gap-2 whitespace-normal leading-snug border-primary/40 text-primary">
                  <Swords className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 break-words">Challenge: earn the 12×10 milestone</span>
                </Button>
              </>
            {selectedProgress.currentPhase === 'completed' && (
              <div className="text-center py-4">
                <Trophy className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="text-lg font-bold text-primary">12×10 MILESTONE</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,5.5rem),1fr))] gap-2 mb-4">
          <Card className="border-border">
            <CardContent className="p-2.5 text-center">
              <p className="break-words text-lg font-bold tabular-nums text-foreground">{selectedProgress.totalWorkouts}</p>
              <p className="break-words text-xs leading-relaxed text-muted-foreground">Workouts</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-2.5 text-center">
              <p className="break-words text-lg font-bold tabular-nums text-primary">{selectedProgress.bestTotalReps}</p>
              <p className="break-words text-xs leading-relaxed text-muted-foreground">Best total</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-2.5 text-center">
              <p className="break-words text-lg font-bold tabular-nums text-foreground">{selectedProgress.xp}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">XP</p>
            </CardContent>
          </Card>
        </div>

        <Button asChild variant="outline" className="mb-4 w-full gap-2">
          <Link to={`/rate?exercise=${selectedExercise}`}><TrendingUp aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="min-w-0">Project your progress to 30×10</span></Link>
        </Button>
        <WorkoutHistory exerciseId={selectedExercise} progress={selectedProgress} />
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-card to-background border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="mb-5 space-y-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h1 className="min-w-0 break-words text-2xl font-bold leading-tight text-foreground tracking-tight">Golden Ratio</h1>
                {syncing && <span role="status" className="text-xs text-muted-foreground">Syncing…</span>}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground mt-1">EMOM · Progressive Overload Engine</p>
              {user && authProfile?.name && (
                <p className="mt-2 break-words text-sm leading-relaxed text-foreground">{authProfile.name}</p>
              )}
            </div>
            <nav aria-label="Main navigation" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Link to="/challenges" className="flex min-w-0 min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-sm leading-snug text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                <Swords className="w-4 h-4 shrink-0" /> <span className="min-w-0 break-words">Fights</span>
              </Link>
              <Link to="/calculator" className="flex min-w-0 min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-sm leading-snug text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                <Calculator className="w-4 h-4 shrink-0" /> <span className="min-w-0 break-words">Calc</span>
              </Link>
              <Link to="/rate" className="flex min-w-0 min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-sm leading-snug text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                <TrendingUp aria-hidden="true" className="w-4 h-4 shrink-0" /> <span className="min-w-0 break-words">Rate</span>
              </Link>
              {user ? (
                <Button
                  variant="outline" size="sm"
                  onClick={async () => { await signOut(); toast.success('Signed out'); }}
                  className="min-w-0 min-h-11 h-auto rounded-lg text-sm text-muted-foreground gap-1.5 px-2 py-2 whitespace-normal"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4 shrink-0" /> <span className="min-w-0">Sign out</span>
                </Button>
              ) : (
                <Button
                  variant="outline" size="sm" onClick={() => navigate('/auth')}
                  className="min-w-0 min-h-11 h-auto rounded-lg text-sm text-muted-foreground gap-1.5 px-2 py-2 whitespace-normal"
                >
                  <LogIn className="w-4 h-4 shrink-0" /> <span className="min-w-0">Sign in</span>
                </Button>
              )}
            </nav>
          </div>

          {/* Level & XP */}
          <Card className="border-primary/20 bg-card/80">
            <CardContent className="p-4">
              <div className="flex min-w-0 items-center gap-3 mb-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Shield aria-hidden="true" className="w-5 h-5 text-primary" />
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="break-words text-base font-semibold text-foreground">Level {profile.level}</p>
                  <p className="break-words text-sm tabular-nums text-muted-foreground">{profile.totalXp} XP</p>
                </div>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(levelProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs leading-relaxed tabular-nums text-muted-foreground mt-2">
                {nextLevelXp - profile.totalXp} XP to Level {profile.level + 1}
              </p>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,4rem),1fr))] gap-2 mt-4 pt-4 border-t border-border text-center">
                <div className="min-w-0">
                  <p className="break-words text-xl font-semibold tabular-nums text-primary">{profile.streak}</p>
                  <p className="break-words text-xs leading-relaxed text-muted-foreground mt-1">Streak</p>
                </div>
                <div className="min-w-0">
                  <p className="break-words text-xl font-semibold tabular-nums text-foreground">{totalMastered}</p>
                  <p className="break-words text-xs leading-relaxed text-muted-foreground mt-1">Mastered</p>
                </div>
                <div className="min-w-0">
                  <p className="break-words text-xl font-semibold tabular-nums text-foreground">{totalWorkouts}</p>
                  <p className="break-words text-xs leading-relaxed text-muted-foreground mt-1">Workouts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'push' | 'pull' | 'legs')}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="push" className="flex-1 gap-1">
              <Dumbbell className="w-3.5 h-3.5" /> Push
            </TabsTrigger>
            <TabsTrigger value="pull" className="flex-1 gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Pull
            </TabsTrigger>
            <TabsTrigger value="legs" className="flex-1 gap-1">
              🦵 Legs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="push">
            <SkillTree
              category="push"
              unlockedExercises={profile.unlockedExercises}
              exerciseProgress={profile.exerciseProgress}
              onSelectExercise={handleSelectExercise}
            />
          </TabsContent>
          <TabsContent value="pull">
            <SkillTree
              category="pull"
              unlockedExercises={profile.unlockedExercises}
              exerciseProgress={profile.exerciseProgress}
              onSelectExercise={handleSelectExercise}
            />
          </TabsContent>
          <TabsContent value="legs">
            <LegSection />
          </TabsContent>
        </Tabs>

        {/* Weekly Progress Chart */}
        <div className="mt-6">
          <WeeklyProgressChart exerciseProgress={profile.exerciseProgress} />
        </div>

        {/* How it works */}
        <Card className="border-border mt-6 mb-8">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 mt-0.5 text-primary" /> How The Algorithm Works
            </h3>
            <div className="space-y-2">
              {[
                { step: '1', title: 'Baseline', desc: 'EMOM 10 min. Find your capacity, up to 30 reps per set.' },
                { step: '2', title: 'Even Out', desc: 'Total reps ÷ 10, distributed front-to-back.' },
                { step: '3', title: 'AMRAP', desc: 'Sets 1-9 at target. Set 10: log as many as you can, up to 30.' },
                { step: '4', title: 'Front Load', desc: 'Surplus from AMRAP added to front. Re-distribute.' },
                { step: '5', title: 'Repeat', desc: 'Earn the 12×10 milestone and unlocks. Keep building toward 30×10.' },
              ].map(item => (
                <div key={item.step} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{item.step}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Account deletion — required for App Store submission. Removes the
            account and personal data; challenges you created are anonymized and
            their links deactivated, other athletes' history is preserved. */}
        {user && (
          <div className="mt-2 mb-10 text-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={deleting}
                  className="min-h-11 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" /> Delete account
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes your profile, workout history, progress, XP and challenge
                    attempts. Friend Challenges you created stop working and show
                    "Former Athlete". Other athletes keep their own results. This cannot
                    be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep my account</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {shareDialog}
    </div>
  );
}
