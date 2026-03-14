import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ExerciseProgress } from '@/types/emom';
import { getExerciseById } from '@/lib/exercises';
import { TrendingUp, Calendar, Zap } from 'lucide-react';

interface WorkoutHistoryProps {
  exerciseId: string;
  progress: ExerciseProgress;
}

export default function WorkoutHistory({ exerciseId, progress }: WorkoutHistoryProps) {
  const exercise = getExerciseById(exerciseId);
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
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Rep Progression</span>
          </div>
          <div className="flex items-end gap-1 h-20">
            {totalRepsOverTime.map((reps, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-primary/80 rounded-t transition-all min-h-[2px]"
                  style={{ height: `${(reps / maxVal) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">Workout 1</span>
            <span className="text-[10px] text-muted-foreground">Workout {totalRepsOverTime.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Session list */}
      <div className="space-y-2">
        {history.slice(0, 10).map((session, idx) => (
          <Card key={session.id} className="border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(session.date).toLocaleDateString()}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">
                    {session.phase.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-sm font-bold text-primary">{session.totalReps} reps</span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {session.sets.map((set, i) => (
                  <div 
                    key={i} 
                    className={`text-center rounded py-0.5 text-xs font-mono ${
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
