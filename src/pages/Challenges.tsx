import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { listSentChallenges, listMyAttempts, ChallengeRow, AttemptRow } from '@/lib/challenges';
import { getExerciseById } from '@/lib/exercises';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { challengeUrl } from '@/lib/share';
import { toast } from 'sonner';
import { Loader2, Swords, Copy } from 'lucide-react';

type Status = 'pending' | 'completed';

function attemptStatus(a: AttemptRow): Status {
  return a.status === 'completed' ? 'completed' : 'pending';
}

export default function Challenges() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sent, setSent] = useState<ChallengeRow[]>([]);
  const [sentAttempts, setSentAttempts] = useState<AttemptRow[]>([]);
  const [received, setReceived] = useState<AttemptRow[]>([]);
  const [receivedChallenges, setReceivedChallenges] = useState<ChallengeRow[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) { setBusy(false); return; }
    (async () => {
      try {
        const s = await listSentChallenges(user.id);
        setSent(s.challenges);
        setSentAttempts(s.attempts);
        const r = await listMyAttempts(user.id);
        setReceived(r.attempts);
        setReceivedChallenges(r.challenges);
      } catch {
        toast.error('Could not load challenge history');
      } finally {
        setBusy(false);
      }
    })();
  }, [user]);

  const exerciseName = (id: string) => getExerciseById(id as never)?.name ?? id;

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto text-center pt-20">
        <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground">Sign in to see your challenges</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Sent, received and completed Friend Challenges live in your account.
        </p>
        <Button onClick={() => navigate('/auth')} className="bg-primary text-primary-foreground">Sign in</Button>
      </div>
    );
  }

  if (busy || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-4 mt-4">Friend Challenges</h1>

      <Tabs defaultValue="received">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="received" className="flex-1">Received</TabsTrigger>
          <TabsTrigger value="sent" className="flex-1">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-2">
          {received.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No challenges received yet.</p>
          )}
          {received.map(a => {
            const ch = receivedChallenges.find(c => c.id === a.challenge_id);
            const status = attemptStatus(a);
            return (
              <Card key={a.id} className="border-border">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {ch?.creator_display_name ?? 'Athlete'} · {exerciseName(ch?.exercise_id ?? '')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {status === 'completed'
                        ? `${a.outcome === 'won' ? 'Won' : a.outcome === 'lost' ? 'Lost' : 'Tied'} · ${a.total_reps ?? 0} reps`
                        : 'Pending — not attempted yet'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="border-primary/40 shrink-0"
                    onClick={() => navigate(`/challenge/${a.challenge_id}`)}>
                    {status === 'completed' ? 'View' : 'Take it'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="sent" className="space-y-2">
          {sent.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No challenges sent yet.</p>
          )}
          {sent.map(c => {
            const attempts = sentAttempts.filter(a => a.challenge_id === c.id);
            const done = attempts.filter(a => a.status === 'completed');
            const beaten = done.filter(a => (a.total_reps ?? 0) > c.creator_total_reps).length;
            return (
              <Card key={c.id} className="border-border">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {exerciseName(c.exercise_id)} · {c.creator_total_reps} reps
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {attempts.length === 0
                        ? 'No attempts yet'
                        : `${attempts.length} ${attempts.length === 1 ? 'attempt' : 'attempts'} · beaten by ${beaten}`}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0"
                    onClick={async () => {
                      const ok = await (await import('@/lib/share')).copyLink(challengeUrl(c.id));
                      ok ? toast.success('Link copied') : toast.error('Could not copy');
                    }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
