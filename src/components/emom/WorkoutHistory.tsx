import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ExerciseProgress } from '@/types/emom';
import { TrendingUp, Calendar, Zap } from 'lucide-react';

interface WorkoutHistoryProps {
  exerciseId: string;
  progress: ExerciseProgress;
}

export default function WorkoutHistory({ progress }: WorkoutHistoryProps) {
  const history = progress.history.slice().reverse();

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No workouts yet. Start your first session!</p>
      </div>
    );
  }

  // Trend data
  const totalRepsOverTime = progress.history.map(s => s.totalReps);
  const maxVal = Math.max(...totalRepsOverTime, 120);

  return (
    <div className="space-y-4">
      {/* Mini chart */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold text-foreground">Rep Progression</span>
          </div>
          <div className="flex items-end gap-px h-20" role="img" aria-label={`Rep progression across ${totalRepsOverTime.length} workouts`}>
            {totalRepsOverTime.map((reps, i) => (
              <div key={i} className="h-full min-w-0 flex-1 flex flex-col items-center justify-end">
                <div 
                  className="w-full bg-primary/80 rounded-t transition-all min-h-[2px]"
                  style={{ height: `${(reps / maxVal) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Workout 1</span>
            <span className="text-xs text-muted-foreground">Workout {totalRepsOverTime.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Session list */}
      <div className="space-y-2">
        {history.slice(0, 10).map((session) => (
          <Card key={session.id} className="border-border">
            <CardContent className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span>{new Date(session.date).toLocaleDateString()}</span>
                  </span>
                  <span className="break-words text-xs px-2 py-1 rounded bg-secondary text-muted-foreground capitalize">
                    {session.phase.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-primary">{session.totalReps} reps</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,2.75rem),1fr))] gap-1.5">
                {session.sets.map((set, i) => (
                  <div 
                    key={i} 
                    aria-label={`Set ${i + 1}: ${set.actualReps ?? 'not recorded'}${set.actualReps == null ? '' : ' reps'}`}
                    className={`min-w-0 break-words text-center rounded py-1.5 text-sm font-mono tabular-nums ${
                      set.isAmrap && (set.actualReps || 0) > 12
                        ? 'bg-primary/20 text-primary font-bold'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {set.actualReps ?? '—'}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
