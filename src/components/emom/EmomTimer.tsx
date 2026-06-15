import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WorkoutPhase, WorkoutSet, WorkoutSession, ExerciseVariation } from '@/types/emom';
import { getExerciseById } from '@/lib/exercises';
import { buildWorkoutSets } from '@/lib/emom-algorithm';
import { EmomAudioEngine } from '@/lib/emomAudio';
import { Play, Pause, RotateCcw, Check, Flame, Zap, Swords } from 'lucide-react';

interface EmomTimerProps {
  exerciseId: ExerciseVariation;
  phase: WorkoutPhase;
  prescription: number[];
  onComplete: (session: WorkoutSession) => void;
  onCancel: () => void;
  isChallenge?: boolean;
}

const TOTAL_TIME = 600;
const SET_INTERVAL_SEC = 60;
const COUNTDOWN_LEAD = 5; // seconds of audible countdown before each minute

function triggerHaptic(pattern: 'tick' | 'warning' | 'start') {
  if (!navigator.vibrate) return;
  switch (pattern) {
    case 'tick': navigator.vibrate(80); break;
    case 'warning': navigator.vibrate([180, 60, 180]); break;
    case 'start': navigator.vibrate([400, 100, 400, 100, 600]); break;
  }
}

export default function EmomTimer({ exerciseId, phase, prescription, onComplete, onCancel, isChallenge = false }: EmomTimerProps) {
  const exercise = getExerciseById(exerciseId);
  const [sets, setSets] = useState<WorkoutSet[]>(() => buildWorkoutSets(prescription, phase));
  const [activeSet, setActiveSet] = useState(0); // timer-driven (which minute we're in)
  const [selectedSet, setSelectedSet] = useState(0); // what the rep pad edits
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const lastActiveRef = useRef(0);

  // Timestamp-based clock — the single source of truth, survives JS throttling.
  const elapsedBeforePauseRef = useRef(0);
  const wallStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Audio engine + wake lock
  const audioRef = useRef<EmomAudioEngine | null>(null);
  const wakeLockRef = useRef<{ release?: () => void } | null>(null);

  // Authoritative elapsed seconds — shared by the visual clock AND the audio scheduler.
  const getElapsed = useCallback(() => {
    const base = elapsedBeforePauseRef.current;
    if (wallStartRef.current === null) return base;
    return base + (Date.now() - wallStartRef.current) / 1000;
  }, []);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new EmomAudioEngine({
        totalTime: TOTAL_TIME,
        setInterval: SET_INTERVAL_SEC,
        countdownLead: COUNTDOWN_LEAD,
      });
    }
    return audioRef.current;
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release?: () => void }> };
      };
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request('screen');
      }
    } catch { /* noop */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    try { wakeLockRef.current?.release?.(); } catch { /* noop */ }
    wakeLockRef.current = null;
  }, []);

  // On returning to the tab: re-acquire wake lock and re-arm audio (the OS may
  // have suspended the AudioContext while we were away). The lookahead scheduler
  // then re-derives upcoming cues from elapsed time, so nothing drifts.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && isRunning) {
        requestWakeLock();
        audioRef.current?.ensureRunning(getElapsed);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isRunning, requestWakeLock, getElapsed]);

  // Visual tick loop (rAF when visible + setInterval backup when throttled).
  useEffect(() => {
    if (!isRunning || isFinished || wallStartRef.current === null) return;

    const update = () => {
      const elapsed = getElapsed();
      const remaining = Math.max(0, TOTAL_TIME - elapsed);
      setTimeLeft(Math.ceil(remaining));
      const newActive = Math.min(Math.floor(elapsed / SET_INTERVAL_SEC), 9);
      setActiveSet(newActive);
      // Auto-follow the active set only if the user hasn't manually picked
      // a different one to edit. Compare against the last active value we saw.
      setSelectedSet(prev => (prev === lastActiveRef.current ? newActive : prev));
      lastActiveRef.current = newActive;

      if (remaining <= 0) {
        setIsRunning(false);
        setIsFinished(true);
        wallStartRef.current = null;
        elapsedBeforePauseRef.current = TOTAL_TIME;
        releaseWakeLock();
        audioRef.current?.pause();
        return;
      }
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    const backup = setInterval(update, 500);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearInterval(backup);
    };
  }, [isRunning, isFinished, releaseWakeLock, getElapsed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, [releaseWakeLock]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const secondsInSet = timeLeft % SET_INTERVAL_SEC || (timeLeft === TOTAL_TIME ? 60 : 0);
  const isCountdown = isRunning && secondsInSet <= COUNTDOWN_LEAD && secondsInSet > 0;

  const logReps = useCallback((reps: number) => {
    setSets(prev => prev.map((s, i) => i === selectedSet ? { ...s, actualReps: reps } : s));
    triggerHaptic('tick');
  }, [selectedSet]);

  const handleStart = async () => {
    elapsedBeforePauseRef.current = 0;
    wallStartRef.current = Date.now();
    const audio = getAudio();
    await audio.start(getElapsed);
    audio.testThump(); // immediate confirmation the sound is working
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
    audioRef.current?.pause();
    releaseWakeLock();
  };

  const handleResume = async () => {
    wallStartRef.current = Date.now();
    await getAudio().resume(getElapsed);
    setIsRunning(true);
    requestWakeLock();
  };

  const handleFinish = () => {
    releaseWakeLock();
    audioRef.current?.stop();
    const totalReps = sets.reduce((sum, s) => sum + (s.actualReps || 0), 0);
    const session: WorkoutSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      exerciseId,
      phase: isChallenge ? 'completed' : phase,
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
  const bannerLabel = isChallenge
    ? '⚔️ CHALLENGE — 60+ reps unlocks · 12×10 masters'
    : phaseLabel[phase];

  const allSetsLogged = sets.every(s => s.actualReps !== null);

  return (
    <div className="space-y-4">
      {/* Phase Banner */}
      <div className={`rounded-lg border p-3 text-center ${isChallenge ? 'bg-primary/10 border-primary/40' : 'bg-secondary/50 border-border'}`}>
        <p className="text-sm font-medium text-primary">{bannerLabel}</p>
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
              {[5, 4, 3, 2, 1].map(n => (
                <div
                  key={n}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
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
            Set {Math.min(selectedSet + 1, 10)} of 10
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
              <Button onClick={() => { releaseWakeLock(); audioRef.current?.stop(); onCancel(); }} variant="ghost" className="gap-2 text-muted-foreground">
                <RotateCcw className="w-4 h-4" /> Cancel
              </Button>
            )}
          </div>

          {/* Background-accuracy hint */}
          {isRunning && (
            <p className="mt-3 text-[10px] text-muted-foreground/70">
              Keep this screen up — we hold it awake so the timer stays exact and the heavy thump fires on every minute, even over music.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Rep Input */}
      {isRunning && (
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2 text-center">
              {sets[selectedSet]?.isAmrap ? (
                <span className="text-primary font-bold flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4" /> AMRAP — Go until failure!
                </span>
              ) : isChallenge ? (
                `Set ${selectedSet + 1}: Hit 12 reps to stay in the challenge`
              ) : phase === 'baseline' ? (
                `Set ${selectedSet + 1}: Go to failure (max 12 reps)`
              ) : (
                `Set ${selectedSet + 1}: Target ${sets[selectedSet]?.targetReps} reps`
              )}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                <Button
                  key={n}
                  variant={sets[selectedSet]?.actualReps === n ? 'default' : 'outline'}
                  size="sm"
                  className={`w-10 h-10 text-sm font-bold ${
                    sets[selectedSet]?.actualReps === n
                      ? 'bg-primary text-primary-foreground'
                      : n > 12 && !sets[selectedSet]?.isAmrap
                        ? 'opacity-40'
                        : ''
                  }`}
                  onClick={() => logReps(n)}
                  disabled={n > 12 && !sets[selectedSet]?.isAmrap && phase !== 'baseline' && !isChallenge}
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
            onClick={() => { if (isRunning || isFinished) setSelectedSet(i); }}
            className={`
              rounded-lg p-3 text-center transition-all border
              ${i === selectedSet && (isRunning || isFinished)
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
              {set.isAmrap ? '🔥MAX' : isChallenge ? '=12' : phase === 'baseline' ? '≤12' : `/${set.targetReps}`}
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
              {isChallenge ? <Swords className="w-5 h-5" /> : <Check className="w-5 h-5" />}
              {isChallenge ? 'Submit Challenge' : 'Complete Workout'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
