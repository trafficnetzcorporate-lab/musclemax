import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExerciseInfo } from '@/types/emom';
import { PUSH_EXERCISES, PULL_EXERCISES } from '@/lib/exercises';
import { ExerciseProgress } from '@/types/emom';
import { Lock, CheckCircle2, ChevronRight, Trophy } from 'lucide-react';

interface SkillTreeProps {
  category: 'push' | 'pull';
  unlockedExercises: string[];
  exerciseProgress: Record<string, ExerciseProgress>;
  onSelectExercise: (id: string) => void;
}

export default function SkillTree({ category, unlockedExercises, exerciseProgress, onSelectExercise }: SkillTreeProps) {
  const exercises = category === 'push' ? PUSH_EXERCISES : PULL_EXERCISES;
  const tiers = [1, 2, 3, 4, 5];

  return (
    <div className="space-y-3">
      {tiers.map(tier => {
        const tierExercises = exercises.filter(e => e.tier === tier);
        if (tierExercises.length === 0) return null;
        
        return (
          <div key={tier}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Tier {tier}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tierExercises.map(ex => {
                const isUnlocked = unlockedExercises.includes(ex.id);
                const progress = exerciseProgress[ex.id];
                const isMastered = progress?.mastered;
                const totalReps = progress?.bestTotalReps || 0;
                const progressPercent = Math.min((totalReps / 120) * 100, 100);

                return (
                  <button
                    key={ex.id}
                    onClick={() => isUnlocked && onSelectExercise(ex.id)}
                    disabled={!isUnlocked}
                    className={`
                      relative rounded-lg border p-3 text-left transition-all
                      ${isMastered 
                        ? 'border-primary bg-primary/10 shadow-glow' 
                        : isUnlocked 
                          ? 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50 cursor-pointer' 
                          : 'border-border/50 bg-card/50 opacity-50 cursor-not-allowed'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{ex.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{ex.name}</span>
                          {isMastered && <Trophy className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                          {!isUnlocked && <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{ex.description}</p>
                        {isUnlocked && progress && (
                          <div className="mt-1.5">
                            <div className="h-1 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {progress.currentPhase.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-primary font-mono">
                                {totalReps}/120
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      {isUnlocked && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
