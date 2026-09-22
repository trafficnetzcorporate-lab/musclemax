import React from 'react';
import { PUSH_EXERCISES, PULL_EXERCISES } from '@/lib/exercises';
import { ExerciseProgress } from '@/types/emom';
import { TARGET_TOTAL_REPS } from '@/lib/emom-limits';
import { Lock, Trophy, Swords } from 'lucide-react';

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
    <div className="space-y-5">
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
            <div className="grid grid-cols-1 gap-2.5">
              {tierExercises.map(ex => {
                const isUnlocked = unlockedExercises.includes(ex.id);
                const progress = exerciseProgress[ex.id];
                const isMastered = progress?.mastered;
                const totalReps = progress?.bestTotalReps || 0;
                const progressPercent = Math.min((totalReps / TARGET_TOTAL_REPS) * 100, 100);

                return (
                  <button
                    key={ex.id}
                    onClick={() => onSelectExercise(ex.id)}
                    className={`
                      relative min-w-0 min-h-11 rounded-xl border p-4 text-left transition-colors
                      ${isMastered
                        ? 'border-primary/60 bg-primary/10'
                        : isUnlocked
                          ? 'border-border bg-card hover:border-primary/50 hover:bg-secondary/50 cursor-pointer'
                          : 'border-border/70 bg-card/60 hover:border-primary/40 cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <span aria-hidden="true" className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg bg-secondary text-[24px]">{ex.icon}</span>
                      <div className="min-w-0 flex-[1_1_8rem]">
                        <div className="flex items-start gap-2">
                          <span className="min-w-0 break-words text-sm leading-snug font-semibold text-foreground">{ex.name}</span>
                          {isMastered && <Trophy aria-label="12×10 milestone earned" className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />}
                          {!isUnlocked && <Lock aria-label="Locked" className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />}
                        </div>
                        <p className="break-words text-xs leading-relaxed text-muted-foreground mt-1">{ex.description}</p>
                        {!isUnlocked && (
                          <div className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed font-medium text-primary">
                            <Swords className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span className="min-w-0">Challenge to unlock</span>
                          </div>
                        )}
                        {isUnlocked && progress && (
                          <div className="mt-3">
                            <div className="h-1 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 mt-1.5">
                              <span className="text-xs capitalize text-muted-foreground">
                                {isMastered ? '12×10 milestone' : progress.currentPhase.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-primary font-mono tabular-nums">
                                {totalReps}/{TARGET_TOTAL_REPS}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
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
