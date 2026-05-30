import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmomStore } from '@/hooks/useEmomStore';
import { getExerciseById, ALL_EXERCISES, getDependents } from '@/lib/exercises';
import { ExerciseVariation, LEVEL_THRESHOLDS, WorkoutSession, XP_REWARDS } from '@/types/emom';
import { processWorkout, calculateWorkoutXp } from '@/lib/emom-algorithm';
import { toast } from 'sonner';
import EmomTimer from './EmomTimer';
import SkillTree from './SkillTree';
import WorkoutHistory from './WorkoutHistory';
import WorkoutSummary from './WorkoutSummary';
import LegSection from './LegSection';
import WeeklyProgressChart from './WeeklyProgressChart';
import { Link } from 'react-router-dom';
import {
  Flame, Trophy, Zap, Target, TrendingUp, Dumbbell,
  ArrowLeft, Star, Shield, ChevronRight, Calculator, Swords, Lock
} from 'lucide-react';

type View = 'dashboard' | 'exercise' | 'workout' | 'summary';

interface SummaryData {
  session: WorkoutSession;
  previousSession: WorkoutSession | null;
  xpEarned: number;
  isMastery: boolean;
  isPR: boolean;
  nextPrescription: number[];
}

export default function EmomDashboard() {
  const { profile, getExerciseProgress, completeWorkout, unlockExercise, applyChallengeWin } = useEmomStore();

  const [view, setView] = useState<View>('dashboard');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'push' | 'pull' | 'legs'>('push');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [challengeMode, setChallengeMode] = useState(false);

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
    const won = session.sets.length === 10 && session.sets.every(s => (s.actualReps ?? 0) >= 12);
    setChallengeMode(false);

    if (!won) {
      const hit = session.sets.filter(s => (s.actualReps ?? 0) >= 12).length;
      toast.error('Challenge not cleared', {
        description: `You need 12 reps on all 10 sets — you hit 12 on ${hit}. Nothing unlocked. Try again when you're ready.`,
      });
      setView('exercise');
      return;
    }

    const info = getExerciseById(session.exerciseId);
    const unlockedNames = getDependents(session.exerciseId).map(e => e.name);
    applyChallengeWin(session);

    setSummaryData({
      session,
      previousSession: null,
      xpEarned: XP_REWARDS.COMPLETE_WORKOUT + XP_REWARDS.MASTER_EXERCISE,
      isMastery: true,
      isPR: true,
      nextPrescription: Array(10).fill(12),
    });
    toast.success(`${info?.name} challenge cleared!`, {
      description: unlockedNames.length
        ? `Mastered. Unlocked: ${unlockedNames.join(', ')}. Earlier tiers are open for logging.`
        : 'Mastered. Earlier tiers are open for logging.',
    });
    setView('summary');
  };

  const handleCompleteWorkout = (session: WorkoutSession) => {
    const progress = getExerciseProgress(session.exerciseId);
    if (!progress) return;

    // Calculate summary data BEFORE completing
    const { nextPrescription, nextPhase } = processWorkout(session, progress);
    const isMastery = nextPhase === 'completed';
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

  const selectedProgress = selectedExercise ? getExerciseProgress(selectedExercise) : null;
  const selectedInfo = selectedExercise ? getExerciseById(selectedExercise) : null;
  const selectedUnlocked = selectedExercise ? profile.unlockedExercises.includes(selectedExercise as ExerciseVariation) : false;

  // --- SUMMARY VIEW ---
  if (view === 'summary' && summaryData) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
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
      : (selectedProgress?.currentPrescription ?? Array(10).fill(12));
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setView('exercise')} className="mb-4 text-muted-foreground">
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
        <Button variant="ghost" size="sm" onClick={() => setView('dashboard')} className="mb-4 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <div className="text-center mb-6">
          <span className="text-5xl">{selectedInfo.icon}</span>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground">{selectedInfo.name}</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{selectedInfo.description}</p>
        </div>

        <Card className="border-primary/40 mb-4">
          <CardContent className="p-4 text-center">
            <Swords className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground mb-1">Challenge to unlock</p>
            <p className="text-xs text-muted-foreground mb-3">
              Normally unlocked by mastering {prereq ? prereq.name : 'its prerequisite'}. Skip the grind:
              hit <span className="text-primary font-bold">12 reps on all 10 sets</span> in one session to
              master it now. Win and you also open every earlier tier for rep-logging plus whatever this move
              unlocks next.
            </p>
            <Button onClick={handleStartChallenge} className="w-full bg-primary text-primary-foreground gap-2">
              <Swords className="w-4 h-4" /> Start Challenge
            </Button>
            <p className="mt-2 text-[10px] text-muted-foreground/70">
              Miss any set and nothing unlocks — you can retry anytime.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- EXERCISE DETAIL VIEW ---
  if (view === 'exercise' && selectedExercise && selectedProgress && selectedInfo) {
    const phaseDescriptions: Record<string, string> = {
      baseline: 'Find your capacity. Go to failure each set (max 12 reps). The timer beeps every minute.',
      standard: 'Hit your targets on sets 1-9, then GO ALL OUT on set 10 (AMRAP). Push past 12 if you can!',
      completed: 'You\'ve mastered this exercise! 12 reps across all 10 sets. 🏆',
    };

    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setView('dashboard')} className="mb-4 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        {/* Exercise Header */}
        <div className="text-center mb-6">
          <span className="text-5xl">{selectedInfo.icon}</span>
          <h2 className="text-2xl font-bold text-foreground mt-2">{selectedInfo.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{selectedInfo.description}</p>
        </div>

        {/* Current Phase */}
        <Card className="border-primary/30 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground capitalize">
                {selectedProgress.currentPhase.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {phaseDescriptions[selectedProgress.currentPhase]}
            </p>

            {selectedProgress.currentPhase !== 'completed' && (
              <>
                <div className="grid grid-cols-10 gap-1 mb-3">
                  {selectedProgress.currentPrescription.map((reps, i) => (
                    <div
                      key={i}
                      className={`text-center rounded py-1 text-xs font-mono font-bold ${
                        selectedProgress.currentPhase === 'standard' && i === 9
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      {selectedProgress.currentPhase === 'standard' && i === 9 ? '🔥' : reps}
                    </div>
                  ))}
                </div>
                <Button onClick={handleStartWorkout} className="w-full bg-primary text-primary-foreground gap-2">
                  <Flame className="w-4 h-4" /> Start Workout
                </Button>
                <Button onClick={handleStartChallenge} variant="outline" className="w-full mt-2 gap-2 border-primary/40 text-primary">
                  <Swords className="w-4 h-4" /> Challenge: master in one session (12×10)
                </Button>
              </>
            )}
            {selectedProgress.currentPhase === 'completed' && (
              <div className="text-center py-4">
                <Trophy className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="text-lg font-bold text-primary">MASTERED</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-foreground">{selectedProgress.totalWorkouts}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Workouts</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-primary">{selectedProgress.bestTotalReps}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Best Total</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-foreground">{selectedProgress.xp}</p>
              <p className="text-[10px] text-muted-foreground uppercase">XP</p>
            </CardContent>
          </Card>
        </div>

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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Golden Ratio</h1>
              <p className="text-xs text-muted-foreground">EMOM · Progressive Overload Engine</p>
            </div>
            <Link to="/calculator" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Calculator className="w-3.5 h-3.5" /> Calc
            </Link>
          </div>

          {/* Level & XP */}
          <Card className="border-primary/20 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{profile.level}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Level {profile.level}</p>
                    <p className="text-xs text-muted-foreground">{profile.totalXp} XP</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-primary">{profile.streak}</p>
                    <p className="text-[10px] text-muted-foreground">🔥 Streak</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{totalMastered}</p>
                    <p className="text-[10px] text-muted-foreground">🏆 Mastered</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{totalWorkouts}</p>
                    <p className="text-[10px] text-muted-foreground">💪 Workouts</p>
                  </div>
                </div>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(levelProgress, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right mt-1">
                {nextLevelXp - profile.totalXp} XP to Level {profile.level + 1}
              </p>
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
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> How The Algorithm Works
            </h3>
            <div className="space-y-2">
              {[
                { step: '1', title: 'Baseline', desc: 'EMOM 10 min. Go to failure each set (max 12).' },
                { step: '2', title: 'Even Out', desc: 'Total reps ÷ 10, distributed front-to-back.' },
                { step: '3', title: 'AMRAP', desc: 'Sets 1-9 at target. Set 10: go until failure.' },
                { step: '4', title: 'Front Load', desc: 'Surplus from AMRAP added to front. Re-distribute.' },
                { step: '5', title: 'Repeat', desc: 'Cycle steps 2-4 until you hit 12×10 = mastery.' },
              ].map(item => (
                <div key={item.step} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
