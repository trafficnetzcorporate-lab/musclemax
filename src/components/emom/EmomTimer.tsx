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

const TOTAL_TIME = 600;
const SET_INTERVAL_SEC = 60;

function triggerHaptic(pattern: 'tick' | 'warning' | 'start') {
  if (!navigator.vibrate) return;
  switch (pattern) {
    case 'tick': navigator.vibrate(80); break;
    case 'warning': navigator.vibrate([180, 60, 180]); break;
    case 'start': navigator.vibrate([400, 100, 400, 100, 600]); break;
  }
}

/* ---------- AUDIO: jarring "heavy clock thump" pre-scheduled in Web Audio ---------- */
/**
 * Schedule a single heavy "echoing clock tick" at a specific AudioContext time.
 * Sound design: low sine thump (60Hz → 40Hz pitch drop) + filtered noise transient
 * + long exponential decay to mimic reverberation in a large hall.
 */
function scheduleHeavyTick(ctx: AudioContext, when: number, intensity: 'soft' | 'hard') {
  const t = Math.max(when, ctx.currentTime);
  const isHard = intensity === 'hard';
  const peak = isHard ? 0.9 : 0.55;
  const decay = isHard ? 1.8 : 0.9;

  // 1) Low sine thump with pitch drop — body of the tick
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(isHard ? 90 : 75, t);
  osc.frequency.exponentialRampToValueAtTime(isHard ? 40 : 50, t + 0.12);
  oscGain.gain.setValueAtTime(0.0001, t);
  oscGain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(oscGain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + decay + 0.05);

  // 2) Noise transient — the percussive "click" of the tick
  const noiseDur = 0.25;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noiseDur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = isHard ? 1800 : 1200;
  bp.Q.value = 0.8;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.exponentialRampToValueAtTime(isHard ? 0.7 : 0.35, t + 0.003);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + (isHard ? 0.55 : 0.3));
  noise.connect(bp).connect(noiseGain).connect(ctx.destination);
  noise.start(t);
  noise.stop(t + noiseDur);
}

/**
 * Pre-schedule every audio cue for the remaining workout time, starting from
 * audioStartTime (an AudioContext time). This way countdown beeps and minute
 * transitions fire on-schedule even if the JS thread is throttled (PWA backgrounded).
 *
 * Returns the source nodes scheduled, so they can be canceled on pause/cancel.
 */
function scheduleAllCues(
  ctx: AudioContext,
  audioStartTime: number,
  elapsedSec: number
): void {
  // For each minute boundary 1..10, schedule:
  // - soft ticks at -3s, -2s, -1s (countdown)
  // - hard thump at the boundary itself
  for (let m = 1; m <= 10; m++) {
    const boundary = m * SET_INTERVAL_SEC;
    if (boundary <= elapsedSec) continue;
    const boundaryAudioT = audioStartTime + (boundary - elapsedSec);
    for (let s = 3; s >= 1; s--) {
      if (boundary - s > elapsedSec) {
        scheduleHeavyTick(ctx, audioStartTime + (boundary - s - elapsedSec), 'soft');
      }
    }
    scheduleHeavyTick(ctx, boundaryAudioT, 'hard');
  }
}

export default function EmomTimer({ exerciseId, phase, prescription, onComplete, onCancel }: EmomTimerProps) {
  const exercise = getExerciseById(exerciseId);
  const [sets, setSets] = useState<WorkoutSet[]>(() => buildWorkoutSets(prescription, phase));
  const [currentSet, setCurrentSet] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Timestamp-based clock — survives JS throttling
  const elapsedBeforePauseRef = useRef(0);
  const wallStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Wake lock
  const wakeLockRef = useRef<any>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    return audioCtxRef.current!;
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {}
  }, []);

  const releaseWakeLock = useCallback(() => {
    try { wakeLockRef.current?.release?.(); } catch {}
    wakeLockRef.current = null;
  }, []);

  // Re-acquire wake lock on visibility return
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && isRunning) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isRunning, requestWakeLock]);

  // Timestamp-driven tick loop (rAF when visible, setInterval fallback always running)
  useEffect(() => {
    if (!isRunning || isFinished || wallStartRef.current === null) return;

    const update = () => {
      const elapsed = elapsedBeforePauseRef.current + (Date.now() - wallStartRef.current!) / 1000;
      const remaining = Math.max(0, TOTAL_TIME - elapsed);
      const remainingInt = Math.ceil(remaining);
      setTimeLeft(remainingInt);
      setCurrentSet(Math.min(Math.floor(elapsed / SET_INTERVAL_SEC), 9));

      if (remaining <= 0) {
        setIsRunning(false);
        setIsFinished(true);
        releaseWakeLock();
        return;
      }
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    // Backup interval in case rAF is paused (tab hidden)
    const backup = setInterval(update, 500);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearInterval(backup);
    };
  }, [isRunning, isFinished, releaseWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      try { audioCtxRef.current?.close(); } catch {}
    };
  }, [releaseWakeLock]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const secondsInSet = timeLeft % SET_INTERVAL_SEC || (timeLeft === TOTAL_TIME ? 60 : 0);
  const isCountdown = isRunning && secondsInSet <= 3 && secondsInSet > 0;

  const logReps = useCallback((reps: number) => {
    setSets(prev => prev.map((s, i) => i === currentSet ? { ...s, actualReps: reps } : s));
    triggerHaptic('tick');
  }, [currentSet]);

  const handleStart = async () => {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    // Schedule everything from time zero
    scheduleAllCues(ctx, ctx.currentTime + 0.05, 0);
    elapsedBeforePauseRef.current = 0;
    wallStartRef.current = Date.now();
    setIsRunning(true);
    triggerHaptic('start');
    requestWakeLock();
  };

  const handlePause = () => {
    if (wallStartRef.current !== null) {
      elapsedBeforePauseRef.current += (Date.now() - wallStartRef.current) / 1000;
      wallStartRef.current = null;
    }
    setIsRunning(false);
    // Suspend audio context to cancel all scheduled cues; we'll reschedule remaining on resume
    try { audioCtxRef.current?.suspend(); } catch {}
    releaseWakeLock();
  };

  const handleResume = async () => {
    const ctx = getAudioCtx();
    // Close and re-create to fully cancel previously scheduled events
    try { await ctx.close(); } catch {}
    audioCtxRef.current = null;
    const newCtx = getAudioCtx();
    if (newCtx.state === 'suspended') await newCtx.resume();
    scheduleAllCues(newCtx, newCtx.currentTime + 0.05, elapsedBeforePauseRef.current);
    wallStartRef.current = Date.now();
    setIsRunning(true);
    requestWakeLock();
  };

  const handleFinish = () => {
    releaseWakeLock();
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
    standard: '🔥 EMOM — Sets 1-9 hit targets, Set 10 GO ALL OUT',
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
      <Card className={`border-primary/30 bg-card transition-all duration-300 ${isCountdown ? 'ring-2 ring-primary/50 shadow-[0_0_30px_hsl(45_93%_58%/0.2)]' : ''}`}>
        <CardContent className="p-6 text-center">
          <div className={`text-6xl font-mono font-bold tracking-wider transition-all duration-300 ${
            isCountdown ? 'text-primary scale-110' : 'text-foreground'
          }`}>
            {formatTime(timeLeft)}
          </div>

          {isCountdown && (
            <div className="mt-3 flex justify-center gap-2">
              {[3, 2, 1].map(n => (
                <div
                  key={n}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    secondsInSet <= n
                      ? 'bg-primary text-primary-foreground scale-110'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {n}
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 text-sm text-muted-foreground">
            Set {Math.min(currentSet + 1, 10)} of 10
          </div>

          <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-linear ${isCountdown ? 'bg-primary animate-pulse' : 'bg-primary'}`}
              style={{ width: `${((TOTAL_TIME - timeLeft) / TOTAL_TIME) * 100}%` }}
            />
          </div>

          <div className="mt-4 flex justify-center gap-3">
            {!isRunning && !isFinished && timeLeft === TOTAL_TIME && (
              <Button onClick={handleStart} className="bg-primary text-primary-foreground gap-2 text-lg px-8 py-6">
                <Play className="w-5 h-5" /> START
              </Button>
            )}
            {isRunning && (
              <Button onClick={handlePause} variant="outline" className="gap-2">
                <Pause className="w-4 h-4" /> Pause
              </Button>
            )}
            {!isRunning && !isFinished && timeLeft < TOTAL_TIME && (
              <Button onClick={handleResume} className="bg-primary text-primary-foreground gap-2">
                <Play className="w-4 h-4" /> Resume
              </Button>
            )}
            {!isRunning && timeLeft < TOTAL_TIME && (
              <Button onClick={() => { releaseWakeLock(); onCancel(); }} variant="ghost" className="gap-2 text-muted-foreground">
                <RotateCcw className="w-4 h-4" /> Cancel
              </Button>
            )}
          </div>

          {/* Background-accuracy hint */}
          {isRunning && (
            <p className="mt-3 text-[10px] text-muted-foreground/70">
              Timer stays accurate in background. Keep volume up — heavy thump on every minute.
            </p>
          )}
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
                  onClick={() => logReps(n)}
                  disabled={n > 12 && !sets[currentSet]?.isAmrap && phase !== 'baseline'}
                >
                  {n}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-10 h-10 text-sm font-bold text-destructive"
                onClick={() => logReps(0)}
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
