import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getExerciseById } from '@/lib/exercises';

interface ChallengeResultCardProps {
  displayName: string;
  exerciseId: string;
  totalReps: number;
  headline?: string;
}

/**
 * Modular share card. Kept presentational so a native iOS renderer can replace it
 * without touching challenge logic.
 */
export default function ChallengeResultCard({
  displayName, exerciseId, totalReps, headline,
}: ChallengeResultCardProps) {
  const exercise = getExerciseById(exerciseId);
  return (
    <Card className="min-w-0 border-primary/40 bg-gradient-to-br from-card to-background [overflow-wrap:anywhere]">
      <CardContent className="px-4 py-6 text-center">
        <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-3">Muscle Max</p>
        <p className="text-sm leading-relaxed font-bold text-foreground uppercase tracking-wide">
          {headline || `${displayName.toUpperCase()} JUST HIT A NEW MAX`}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground mt-1">
          {exercise?.icon} 10-Minute {exercise?.name ?? 'EMOM'} EMOM
        </p>
        <p className="text-[min(3.75rem,16vw)] font-black tabular-nums text-primary mt-4 leading-tight">{totalReps}</p>
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase mt-1">Total Reps</p>
        <p className="mt-4 text-sm leading-relaxed font-bold text-foreground uppercase tracking-wide">Can you beat it?</p>
      </CardContent>
    </Card>
  );
}
