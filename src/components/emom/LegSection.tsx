import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ChevronDown, ChevronUp } from 'lucide-react';

interface WorkoutLog {
  date: string;
  squatSets: number;
  squatReps: number;
  abSets: number;
  abRestSeconds: number;
}

const STORAGE_KEY = 'emom_leg_logs';

function loadLogs(): WorkoutLog[] {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

function saveLogs(logs: WorkoutLog[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

const AB_EXERCISES = [
  { name: 'Bicycle Crunches', icon: '🚴', target: 'Upper & lower abs, obliques' },
  { name: 'Flutter Kicks', icon: '🦵', target: 'Lower abs, hip flexors' },
  { name: 'Leg Raises', icon: '🦿', target: 'Lower abs, core stability' },
  { name: 'V-Ups', icon: '✌️', target: 'Full abs, hip flexors' },
];

export default function LegSection() {
  const [logs, setLogs] = useState<WorkoutLog[]>(loadLogs);
  const [squatSets, setSquatSets] = useState(5);
  const [squatReps, setSquatReps] = useState(50);
  const [abSets, setAbSets] = useState(3);
  const [abRestSeconds, setAbRestSeconds] = useState(180);
  const [showAbDetail, setShowAbDetail] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const lastLog = logs[logs.length - 1];

  const logWorkout = () => {
    const newLog: WorkoutLog = {
      date: new Date().toISOString(),
      squatSets,
      squatReps,
      abSets,
      abRestSeconds,
    };
    const updated = [...logs, newLog];
    setLogs(updated);
    saveLogs(updated);
  };

  const adjust = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number, min: number, max: number) => {
    setter(prev => Math.max(min, Math.min(max, prev + delta)));
  };

  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      {/* Squat Section */}
      <Card className="border-border">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            🦵 Squats — Leg Mass
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            High-rep bodyweight squats for leg muscle mass. Rest 1:30 between sets. Your legs will be done for 2 days.
          </p>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
            {/* Sets */}
            <div className="min-w-0 bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Sets</p>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <Button variant="ghost" size="sm" className="h-auto min-h-[44px] w-[44px] shrink-0 p-0" aria-label="Decrease squat sets" onClick={() => adjust(setSquatSets, -1, 1, 10)}>
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="order-first basis-full min-w-0 text-2xl font-bold tabular-nums text-foreground text-center">{squatSets}</span>
                <Button variant="ghost" size="sm" className="h-auto min-h-[44px] w-[44px] shrink-0 p-0" aria-label="Increase squat sets" onClick={() => adjust(setSquatSets, 1, 1, 10)}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">5-7 recommended</p>
            </div>

            {/* Reps */}
            <div className="min-w-0 bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Reps per set</p>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <Button variant="ghost" size="sm" className="h-auto min-h-[44px] w-[44px] shrink-0 p-0" aria-label="Decrease reps per squat set" onClick={() => adjust(setSquatReps, -5, 10, 100)}>
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="order-first basis-full min-w-0 text-2xl font-bold tabular-nums text-foreground text-center">{squatReps}</span>
                <Button variant="ghost" size="sm" className="h-auto min-h-[44px] w-[44px] shrink-0 p-0" aria-label="Increase reps per squat set" onClick={() => adjust(setSquatReps, 5, 10, 100)}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">50 standard</p>
            </div>
          </div>

          <div className="mt-3 text-center">
            <p className="text-xs text-muted-foreground">
              Total: <span className="font-bold text-foreground">{squatSets * squatReps}</span> squats &middot; Rest 1:30 between sets
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ab Section */}
      <Card className="border-border">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            🔥 Ab Circuit — Core Destruction
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            30 seconds per exercise, back-to-back (2 min tension). Rest between sets. Reduce rest time to progressively overload.
          </p>

          {/* Ab exercises */}
          <button
            onClick={() => setShowAbDetail(!showAbDetail)}
            aria-expanded={showAbDetail}
            className="min-h-11 w-full flex items-center justify-between gap-3 py-2 text-left text-xs leading-relaxed text-primary font-medium mb-2"
          >
            <span className="min-w-0">4 exercises × 30 sec each = 2 min per set</span>
            {showAbDetail ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
          </button>

          {showAbDetail && (
            <div className="space-y-2 mb-3">
              {AB_EXERCISES.map((ex, i) => (
                <div key={i} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 bg-secondary/30 rounded-lg px-3 py-2">
                  <span className="text-lg">{ex.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{ex.name}</p>
                    <p className="text-[10px] text-muted-foreground">{ex.target}</p>
                  </div>
                  <span className="col-start-2 text-[10px] text-primary font-mono">30s</span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground italic">
                Do all 4 exercises back-to-back without rest. That's 1 set (2 min of tension).
              </p>
            </div>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
            {/* Ab Sets */}
            <div className="min-w-0 bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Sets</p>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <Button variant="ghost" size="sm" className="h-auto min-h-[44px] w-[44px] shrink-0 p-0" aria-label="Decrease ab sets" onClick={() => adjust(setAbSets, -1, 1, 10)}>
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="order-first basis-full min-w-0 text-2xl font-bold tabular-nums text-foreground text-center">{abSets}</span>
                <Button variant="ghost" size="sm" className="h-auto min-h-[44px] w-[44px] shrink-0 p-0" aria-label="Increase ab sets" onClick={() => adjust(setAbSets, 1, 1, 10)}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">3-5 recommended</p>
            </div>

            {/* Rest Time */}
            <div className="min-w-0 bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Rest (sec)</p>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <Button variant="ghost" size="sm" className="h-auto min-h-[44px] w-[44px] shrink-0 p-0" aria-label="Decrease rest time" onClick={() => adjust(setAbRestSeconds, -15, 60, 300)}>
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="order-first basis-full min-w-0 text-2xl font-bold tabular-nums text-foreground text-center">{abRestSeconds}</span>
                <Button variant="ghost" size="sm" className="h-auto min-h-[44px] w-[44px] shrink-0 p-0" aria-label="Increase rest time" onClick={() => adjust(setAbRestSeconds, 15, 60, 300)}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Start 180, reduce over time</p>
            </div>
          </div>

          <div className="mt-3 text-center">
            <p className="text-xs text-muted-foreground">
              Total: <span className="font-bold text-foreground">{abSets * 2}</span> min tension &middot;{' '}
              <span className="font-bold text-foreground">{Math.floor(((abSets - 1) * abRestSeconds) / 60)}:{(((abSets - 1) * abRestSeconds) % 60).toString().padStart(2, '0')}</span> rest
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Log Button */}
      <Button onClick={logWorkout} className="h-auto min-h-12 w-full whitespace-normal bg-primary text-primary-foreground gap-2 py-3">
        ✅ Log Leg Day
      </Button>

      {/* Progress hint */}
      <Card className="border-border">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Progressive Overload:</span> Increase squat reps or add more sets. For abs, decrease rest time or add more sets. No timer needed — go at your own pace.
          </p>
        </CardContent>
      </Card>

      {/* History */}
      {logs.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            aria-expanded={showHistory}
            className="min-h-11 max-w-full flex items-center gap-2 py-2 text-left text-xs text-primary font-medium mb-2"
          >
            {showHistory ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
            History ({logs.length} sessions)
          </button>
          {showHistory && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[...logs].reverse().slice(0, 10).map((log, i) => (
                <div key={i} className="min-w-0 bg-secondary/30 rounded-lg px-3 py-3 text-xs flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <span className="text-muted-foreground">{new Date(log.date).toLocaleDateString()}</span>
                  <div className="min-w-0 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-foreground">🦵 {log.squatSets}×{log.squatReps}</span>
                    <span className="text-foreground">🔥 {log.abSets} sets / {log.abRestSeconds}s rest</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
