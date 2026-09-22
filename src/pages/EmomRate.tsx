import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_EXERCISES } from '@/lib/exercises';
import { useEmomStore } from '@/hooks/useEmomStore';
import EmomRateCalculator from '@/components/emom/EmomRateCalculator';

export default function EmomRate() {
  const [params, setParams] = useSearchParams();
  const { profile } = useEmomStore();
  const exerciseId = ALL_EXERCISES.find(exercise => exercise.id === params.get('exercise'))?.id ?? 'regular_pushup';
  const history = profile.exerciseProgress[exerciseId]?.history ?? [];
  return (
    <main className="mx-auto min-h-dvh min-w-0 max-w-lg space-y-5 bg-background p-4 pb-10 [overflow-wrap:anywhere]">
      <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft aria-hidden="true" className="mr-1 h-4 w-4" /> Back to workouts</Link></Button>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold leading-tight">Progress rate</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">Turn your reps and training schedule into a plan for 30 reps across all 10 sets.</p>
      </header>
      <div className="space-y-2">
        <Label htmlFor="rate-exercise">Push or pull exercise</Label>
        <Select value={exerciseId} onValueChange={exercise => setParams({ exercise }, { replace: true })}>
          <SelectTrigger id="rate-exercise"><SelectValue /></SelectTrigger>
          <SelectContent>{ALL_EXERCISES.map(exercise => <SelectItem key={exercise.id} value={exercise.id}>{exercise.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <EmomRateCalculator key={exerciseId} exerciseId={exerciseId} history={history} />
    </main>
  );
}
