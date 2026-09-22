import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ExerciseProgress } from '@/types/emom';
import { getExerciseById } from '@/lib/exercises';
import { BarChart3 } from 'lucide-react';

interface WeeklyProgressChartProps {
  exerciseProgress: Record<string, ExerciseProgress>;
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return `${start.getMonth() + 1}/${start.getDate()}`;
}

const COLORS = [
  'hsl(45, 93%, 58%)',   // primary gold
  'hsl(200, 80%, 60%)',  // blue
  'hsl(140, 70%, 50%)',  // green
  'hsl(280, 70%, 60%)',  // purple
  'hsl(15, 80%, 55%)',   // orange
  'hsl(340, 70%, 55%)',  // pink
];

export default function WeeklyProgressChart({ exerciseProgress }: WeeklyProgressChartProps) {
  const { chartData, exerciseNames } = useMemo(() => {
    const weekMap: Record<string, Record<string, number>> = {};
    const names: { id: string; name: string }[] = [];

    for (const [id, progress] of Object.entries(exerciseProgress)) {
      if (progress.history.length === 0) continue;
      const info = getExerciseById(id);
      if (!info) continue;
      names.push({ id, name: info.name });

      for (const session of progress.history) {
        const week = getWeekLabel(session.date);
        if (!weekMap[week]) weekMap[week] = {};
        weekMap[week][id] = (weekMap[week][id] || 0) + session.totalReps;
      }
    }

    // Sort weeks chronologically
    const sortedWeeks = Object.keys(weekMap).sort((a, b) => {
      const [am, ad] = a.split('/').map(Number);
      const [bm, bd] = b.split('/').map(Number);
      return am !== bm ? am - bm : ad - bd;
    });

    const data = sortedWeeks.map(week => ({
      week,
      ...weekMap[week],
    }));

    return { chartData: data, exerciseNames: names };
  }, [exerciseProgress]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="min-w-0 border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold text-foreground">Weekly Total Reps</span>
        </div>
        <div className="h-48 min-w-0" role="img" aria-label="Weekly total reps by exercise. Values are available by selecting a point on the chart.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
              <XAxis
                dataKey="week"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                stroke="hsl(220, 13%, 20%)"
                minTickGap={24}
                interval="preserveStartEnd"
              />
              <YAxis
                width={48}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                stroke="hsl(220, 13%, 20%)"
              />
              <Tooltip
                wrapperStyle={{ maxWidth: 'min(220px, calc(100vw - 64px))', outline: 'none' }}
                itemStyle={{ whiteSpace: 'normal', overflowWrap: 'anywhere', padding: '3px 0' }}
                contentStyle={{
                  backgroundColor: 'hsl(220, 13%, 11%)',
                  border: '1px solid hsl(220, 13%, 20%)',
                  borderRadius: '8px',
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  color: 'hsl(210, 40%, 98%)',
                }}
              />
              {exerciseNames.map((ex, i) => (
                <Line
                  key={ex.id}
                  type="monotone"
                  dataKey={ex.id}
                  name={ex.name}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 space-y-2" aria-label="Exercises on chart">
          {exerciseNames.map((ex, i) => (
            <li key={ex.id} className="flex min-w-0 items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="min-w-0 break-words">{ex.name}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
