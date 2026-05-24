import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WorkoutSession, ExerciseProgress, XP_REWARDS } from '@/types/emom';
import { getExerciseById } from '@/lib/exercises';
import { Trophy, Zap, TrendingUp, ArrowUp, ArrowDown, Minus, Star, Flame } from 'lucide-react';

interface WorkoutSummaryProps {
  session: WorkoutSession;
  previousSession?: WorkoutSession | null;
  xpEarned: number;
  isMastery: boolean;
  isPR: boolean;
  nextPrescription: number[];
  onContinue: () => void;
}

export default function WorkoutSummary({
  session, previousSession, xpEarned, isMastery, isPR, nextPrescription, onContinue
}: WorkoutSummaryProps) {
  const hasConfettied = useRef(false);
  const exercise = getExerciseById(session.exerciseId);
  const totalReps = session.sets.reduce((s, set) => s + (set.actualReps || 0), 0);
  const prevTotalReps = previousSession
    ? previousSession.sets.reduce((s, set) => s + (set.actualReps || 0), 0)
    : null;
  const repDiff = prevTotalReps !== null ? totalReps - prevTotalReps : null;

  useEffect(() => {
    if (hasConfettied.current) return;
    hasConfettied.current = true;

    if (isMastery) {
      // Big celebration
      const end = Date.now() + 3000;
      const interval = setInterval(() => {
        confetti({ particleCount: 80, spread: 100, origin: { x: Math.random(), y: Math.random() * 0.6 } });
        if (Date.now() > end) clearInterval(interval);
      }, 250);
      return () => clearInterval(interval);
    } else if (isPR) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } }), 500);
    } else {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    }
  }, [isMastery, isPR]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="text-center py-4">
        {isMastery ? (
          <>
            <Trophy className="w-16 h-16 text-primary mx-auto mb-2 animate-bounce" />
            <h2 className="text-3xl font-black text-primary">MASTERED!</h2>
            <p className="text-sm text-muted-foreground mt-1">You've hit 12×10. Legendary.</p>
          </>
        ) : isPR ? (
          <>
            <Star className="w-14 h-14 text-primary mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-primary">NEW PR!</h2>
            <p className="text-sm text-muted-foreground mt-1">Personal best total reps!</p>
          </>
        ) : (
          <>
            <Flame className="w-12 h-12 text-primary mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-foreground">Workout Complete</h2>
            <p className="text-sm text-muted-foreground mt-1">{exercise?.icon} {exercise?.name}</p>
          </>
        )}
      </div>

      {/* XP Earned */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-3xl font-black text-primary">+{xpEarned} XP</span>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <span className="bg-secondary px-2 py-0.5 rounded">Workout: +{XP_REWARDS.COMPLETE_WORKOUT}</span>
            {session.sets[9]?.isAmrap && (
              <span className="bg-secondary px-2 py-0.5 rounded">AMRAP Bonus</span>
            )}
            {isMastery && (
              <span className="bg-primary/20 text-primary px-2 py-0.5 rounded">Mastery: +{XP_REWARDS.MASTER_EXERCISE}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rep Comparison */}
      <Card className="border-border">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Rep Breakdown
          </h3>

          {/* Set-by-set comparison */}
          <div className="space-y-1.5">
            {session.sets.map((set, i) => {
              const prevReps = previousSession?.sets[i]?.actualReps;
              const diff = prevReps != null && set.actualReps != null ? set.actualReps - prevReps : null;
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-[10px] text-muted-foreground w-8">S{set.setNumber}</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${((set.actualReps || 0) / 12) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-foreground w-6 text-right">
                    {set.actualReps ?? 0}
                  </span>
                  {diff !== null && (
                    <span className={`text-[10px] font-bold w-8 text-right flex items-center justify-end gap-0.5 ${
                      diff > 0 ? 'text-green-400' : diff < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {diff > 0 ? <ArrowUp className="w-3 h-3" /> : diff < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {Math.abs(diff)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total comparison */}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">{totalReps}</span>
              {repDiff !== null && (
                <span className={`text-sm font-bold ${
                  repDiff > 0 ? 'text-green-400' : repDiff < 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {repDiff > 0 ? '+' : ''}{repDiff}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Workout Preview */}
      {!isMastery && (
        <Card className="border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Next Workout</h3>
            <div className="grid grid-cols-10 gap-1">
              {nextPrescription.map((reps, i) => (
                <div key={i} className="text-center rounded py-1 bg-secondary text-xs font-mono font-bold text-foreground">
                  {reps === -1 ? '🔥' : reps}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={onContinue} className="w-full bg-primary text-primary-foreground py-6 text-lg">
        Continue
      </Button>
    </div>
  );
}
