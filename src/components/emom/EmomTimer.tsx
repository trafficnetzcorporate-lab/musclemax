import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WorkoutPhase, WorkoutSet, WorkoutSession, ExerciseVariation } from '@/types/emom';
import { getExerciseById } from '@/lib/exercises';
import { buildWorkoutSets } from '@/lib/emom-algorithm';
import { Play, Pause, RotateCcw, Check, Flame, Zap } from 'lucide-react';

interface EmomTimerProps {
  exerciseId: ExerciseVariation;
  phase: WorkoutPhase;
  prescription: number[];
  onComplete: (session: WorkoutSession) => void;
  onCancel: () => void;
}

const TOTAL_TIME = 600; // 10 minutes in seconds
const SET_INTERVAL_SEC = 60;

export default function EmomTimer({ exerciseId, phase, prescription, onComplete, onCancel }: EmomTimerProps) {
  const exercise = getExerciseById(exerciseId);
  const [sets, setSets] = useState<WorkoutSet[]>(() => buildWorkoutSets(prescription, phase));
  const [currentSet, setCurrentSet] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [repInput, setRepInput] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const playBeep = useCallback(() => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }, []);

  // Timer logic
  useEffect(() => {
    if (!isRunning || isFinished) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          setIsRunning(false);
          setIsFinished(true);
          return 0;
        }
        // Beep on new minute
        if (next % SET_INTERVAL_SEC === 0 && next < TOTAL_TIME) {
          playBeep();
          // Auto-advance set if user hasn't logged yet
          setCurrentSet(prev => {
            const newSet = Math.min(prev + 1, 9);
            return newSet;
          });
          setWaitingForInput(true);
        }
        // Warning beeps at 3, 2, 1
        if (next % SET_INTERVAL_SEC <= 3 && next % SET_INTERVAL_SEC > 0) {
          playBeep();
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isFinished, playBeep]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentMinute = Math.floor((TOTAL_TIME - timeLeft) / SET_INTERVAL_SEC);
  const secondsInSet = timeLeft % SET_INTERVAL_SEC || (timeLeft === TOTAL_TIME ? 60 : 0);

  const logReps = useCallback((reps: number) => {
    setSets(prev => prev.map((s, i) =>
      i === currentSet ? { ...s, actualReps: reps } : s
    ));
    setRepInput('');
    setWaitingForInput(false);
  }, [currentSet]);

  const quickLog = useCallback((reps: number) => {
    logReps(reps);
  }, [logReps]);

  const handleStart = () => {
    setIsRunning(true);
    setWaitingForInput(true);
    playBeep();
  };

  const handleFinish = () => {
    const totalReps = sets.reduce((sum, s) => sum + (s.actualReps || 0), 0);
    const session: WorkoutSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      exerciseId,
      phase,
      sets,
      totalReps,
    };
    onComplete(session);
  };

  const phaseLabel: Record<WorkoutPhase, string> = {
    baseline: '🎯 BASELINE — Go to failure each set (max 12)',
    evening_out: '⚖️ EVENING OUT — Hit your targets consistently',
    amrap: '🔥 AMRAP — Sets 1-9 normal, Set 10 GO ALL OUT',
    front_load: '📈 FRONT LOAD — New targets from your surplus',
    completed: '🏆 MASTERED',
  };

  const allSetsLogged = sets.every(s => s.actualReps !== null);

  return (
    <div className="space-y-4">
      {/* Phase Banner */}
      <div className="rounded-lg bg-secondary/50 border border-border p-3 text-center">
        <p className="text-sm font-medium text-primary">{phaseLabel[phase]}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {exercise?.icon} {exercise?.name}
        </p>
      </div>

      {/* Timer Display */}
      <Card className="border-primary/30 bg-card">
        <CardContent className="p-6 text-center">
          <div className="text-6xl font-mono font-bold text-foreground tracking-wider">
            {formatTime(timeLeft)}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Set {Math.min(currentSet + 1, 10)} of 10
          </div>
          
          {/* Progress bar */}
          <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${((TOTAL_TIME - timeLeft) / TOTAL_TIME) * 100}%` }}
            />
          </div>

          {/* Timer controls */}
          <div className="mt-4 flex justify-center gap-3">
            {!isRunning && !isFinished && timeLeft === TOTAL_TIME && (
              <Button onClick={handleStart} className="bg-primary text-primary-foreground gap-2 text-lg px-8 py-6">
                <Play className="w-5 h-5" /> START
              </Button>
            )}
            {isRunning && (
              <Button onClick={() => setIsRunning(false)} variant="outline" className="gap-2">
                <Pause className="w-4 h-4" /> Pause
              </Button>
            )}
            {!isRunning && !isFinished && timeLeft < TOTAL_TIME && (
              <Button onClick={() => setIsRunning(true)} className="bg-primary text-primary-foreground gap-2">
                <Play className="w-4 h-4" /> Resume
              </Button>
            )}
            {!isRunning && timeLeft < TOTAL_TIME && (
              <Button onClick={onCancel} variant="ghost" className="gap-2 text-muted-foreground">
                <RotateCcw className="w-4 h-4" /> Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rep Input */}
      {isRunning && (
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2 text-center">
              {sets[currentSet]?.isAmrap ? (
                <span className="text-primary font-bold flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4" /> AMRAP — Go until failure!
                </span>
              ) : phase === 'baseline' ? (
                `Set ${currentSet + 1}: Go to failure (max 12 reps)`
              ) : (
                `Set ${currentSet + 1}: Target ${sets[currentSet]?.targetReps} reps`
              )}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                <Button
                  key={n}
                  variant={sets[currentSet]?.actualReps === n ? 'default' : 'outline'}
                  size="sm"
                  className={`w-10 h-10 text-sm font-bold ${
                    sets[currentSet]?.actualReps === n 
                      ? 'bg-primary text-primary-foreground' 
                      : n > 12 && !sets[currentSet]?.isAmrap 
                        ? 'opacity-40' 
                        : ''
                  }`}
                  onClick={() => quickLog(n)}
                  disabled={n > 12 && !sets[currentSet]?.isAmrap && phase !== 'baseline'}
                >
                  {n}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-10 h-10 text-sm font-bold text-destructive"
                onClick={() => quickLog(0)}
              >
                0
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Set Grid */}
      <div className="grid grid-cols-5 gap-2">
        {sets.map((set, i) => (
          <button
            key={i}
            onClick={() => { if (isRunning || isFinished) setCurrentSet(i); }}
            className={`
              rounded-lg p-3 text-center transition-all border
              ${i === currentSet && (isRunning || isFinished)
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                : set.actualReps !== null
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card'
              }
            `}
          >
            <div className="text-[10px] text-muted-foreground uppercase">Set {set.setNumber}</div>
            <div className={`text-lg font-bold ${set.actualReps !== null ? 'text-primary' : 'text-muted-foreground'}`}>
              {set.actualReps !== null ? set.actualReps : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {set.isAmrap ? '🔥MAX' : phase === 'baseline' ? '≤12' : `/${set.targetReps}`}
            </div>
          </button>
        ))}
      </div>

      {/* Total & Finish */}
      {(isRunning || isFinished) && (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm">
              Total: <span className="text-foreground font-bold text-lg">
                {sets.reduce((s, set) => s + (set.actualReps || 0), 0)}
              </span> reps
            </span>
          </div>
          {(isFinished || allSetsLogged) && (
            <Button onClick={handleFinish} className="bg-primary text-primary-foreground gap-2 px-8 py-6 text-lg w-full">
              <Check className="w-5 h-5" /> Complete Workout
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
