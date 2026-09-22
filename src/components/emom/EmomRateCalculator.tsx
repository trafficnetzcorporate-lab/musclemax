import { useId, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_REPS_PER_SET, NUM_SETS } from '@/lib/emom-limits';
import { observedEmomRate, projectEmomRate } from '@/lib/emom-rate';
import type { WorkoutSession } from '@/types/emom';
import { TrendingUp, Target } from 'lucide-react';

interface Props {
  exerciseId: string;
  history: WorkoutSession[];
}

const displayNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function EmomRateCalculator({ exerciseId, history }: Props) {
  const id = useId();
  const observed = observedEmomRate(history, exerciseId);
  const [currentTotal, setCurrentTotal] = useState(() => observed.latestTotal === null ? '' : String(observed.latestTotal));
  const [targetPerSet, setTargetPerSet] = useState(String(MAX_REPS_PER_SET));
  const [gain, setGain] = useState('1');
  const [frequency, setFrequency] = useState('6');
  const numeric = (value: string) => value.trim() === '' ? NaN : Number(value);
  const inputs = {
    currentTotal: numeric(currentTotal), targetPerSet: numeric(targetPerSet),
    gainPerSession: numeric(gain), sessionsPerWeek: numeric(frequency),
  };
  const projection = projectEmomRate(inputs);
  const scenarioRates = [1, 2, 3, 4];

  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      <Card className="border-primary/30">
        <CardContent className="p-4 space-y-4">
          <div>
            <h2 className="flex items-start gap-2 text-lg font-semibold leading-snug">
              <Target aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">Your EMOM projection</span>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choose a target across all {NUM_SETS} sets. Gain means extra reps in the whole workout per session, averaged over good days, stalls, and setbacks.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-current`}>Current total reps</Label>
              <Input id={`${id}-current`} type="number" inputMode="numeric" min={0} max={300} step={1}
                placeholder="Across all 10 sets" value={currentTotal} onChange={event => setCurrentTotal(event.target.value)} />
              {observed.latestTotal !== null && (
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setCurrentTotal(String(observed.latestTotal))}>
                  Use latest: {observed.latestTotal}
                </Button>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-target`}>Target reps per set</Label>
              <Input id={`${id}-target`} type="number" inputMode="numeric" min={1} max={MAX_REPS_PER_SET} step={1}
                value={targetPerSet} onChange={event => setTargetPerSet(event.target.value)} />
              <p className="text-xs leading-relaxed text-muted-foreground">Up to {MAX_REPS_PER_SET} in each of {NUM_SETS} sets.</p>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-gain`}>Planned gain per session</Label>
              <Input id={`${id}-gain`} type="number" inputMode="decimal" step="any" value={gain}
                onChange={event => setGain(event.target.value)} aria-describedby={`${id}-gain-help`} />
              <p id={`${id}-gain-help`} className="text-xs leading-relaxed text-muted-foreground">Total extra reps, not extra reps in every set. Decimals are allowed.</p>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-frequency`}>Sessions per week</Label>
              <Input id={`${id}-frequency`} type="number" inputMode="decimal" min={1} max={7} step="any" value={frequency}
                onChange={event => setFrequency(event.target.value)} />
              <p className="text-xs leading-relaxed text-muted-foreground">For this exercise. Rest days are included in the time estimate.</p>
            </div>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3" aria-live="polite" aria-atomic="true">
            {projection.status === 'invalid' ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{currentTotal === '' ? 'Enter your current total to calculate a timeline.' : projection.message}</p>
            ) : projection.status === 'no-growth' ? (
              <>
                <p className="font-semibold">No arrival estimate at this rate</p>
                <p className="text-sm leading-relaxed text-muted-foreground">There are {projection.remainingReps} reps left to reach {projection.targetTotal}. A zero or declining average does not project an arrival time.</p>
              </>
            ) : projection.status === 'reached' ? (
              <>
                <p className="font-semibold text-primary">Your total meets this target</p>
                <p className="text-sm leading-relaxed text-muted-foreground">Check your set breakdown too: the goal is {targetPerSet} reps in every set, not just {projection.targetTotal} combined.</p>
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-muted-foreground">{projection.remainingReps} more total reps to reach {targetPerSet} × {NUM_SETS} = {projection.targetTotal}</p>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,6rem),1fr))] gap-3">
                  <div><p className="text-2xl font-bold tabular-nums text-primary">{displayNumber(projection.sessions)}</p><p className="text-xs leading-relaxed text-muted-foreground">more sessions</p></div>
                  <div><p className="text-2xl font-bold tabular-nums text-foreground">~{displayNumber(projection.calendarDays)}</p><p className="text-xs leading-relaxed text-muted-foreground">calendar days</p></div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">About {displayNumber(projection.weeks)} weeks at +{gain} total reps per session and {frequency} sessions each week.</p>
              </>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">This is a constant-rate planning estimate, not a guaranteed improvement schedule. Update it as your logged performance changes.</p>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <h2 className="flex items-start gap-2 text-base font-semibold leading-snug">
            <TrendingUp aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="min-w-0">Your observed rate</span>
          </h2>
          {observed.averageGain === null ? (
            <p className="text-sm leading-relaxed text-muted-foreground">Log at least two complete workouts of this exercise to see your actual average gain and how often your total improves.</p>
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3">
                <div><p className="text-xl font-bold tabular-nums text-primary">{observed.averageGain > 0 ? '+' : ''}{displayNumber(observed.averageGain)}</p><p className="text-xs leading-relaxed text-muted-foreground">total reps per session</p></div>
                <div><p className="text-xl font-bold tabular-nums">{displayNumber(observed.improvementPercent ?? 0)}%</p><p className="text-xs leading-relaxed text-muted-foreground">sessions improved ({observed.improvedSessions}/{observed.comparisonCount})</p></div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">Based on your last {observed.sessionCount} complete workouts. Gains, stalls, and losses all count. This describes past sessions; it is not a probability of future success.</p>
              <Button type="button" variant="outline" className="w-full" onClick={() => setGain(String(observed.averageGain))}>Use observed rate</Button>
            </>
          )}
        </CardContent>
      </Card>

      {projection.status !== 'invalid' && projection.status !== 'reached' && (
        <Card className="border-border">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-base font-semibold">Compare rates</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">Same starting total, goal, and weekly frequency.</p>
            <div className="space-y-2">
              {scenarioRates.map(rate => {
                const result = projectEmomRate({ ...inputs, gainPerSession: rate });
                if (result.status !== 'projected') return null;
                return <div key={rate} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-secondary p-3 text-sm leading-relaxed">
                  <span className="font-medium text-primary">+{rate} rep{rate === 1 ? '' : 's'}/session</span>
                  <span className="text-muted-foreground">{displayNumber(result.sessions)} sessions · ~{displayNumber(result.calendarDays)} days</span>
                </div>;
              })}
            </div>
          </CardContent>
        </Card>
      )}
      <p className="px-1 text-sm leading-relaxed text-muted-foreground">
        {exerciseId.includes('pushup') ? '60 continuous push-ups in two minutes is a separate goal. ' : ''}
        EMOM allows rest within each minute; reaching a set target does not verify an unbroken timed set.
      </p>
    </div>
  );
}
