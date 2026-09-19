import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useEmomStore } from '@/hooks/useEmomStore';
import { getPublicChallenge, startChallengeAttempt, completeChallengeAttempt, PublicChallenge, AttemptResult } from '@/lib/challenges';
import { pushSession } from '@/lib/emom-sync';
import { setPostAuthRedirect } from '@/hooks/useAuth';
import { challengeUrl, copyLink, shareChallenge } from '@/lib/share';
import { getExerciseById } from '@/lib/exercises';
import { ExerciseVariation, WorkoutSession } from '@/types/emom';
import EmomTimer from '@/components/emom/EmomTimer';
import ShareChallengeDialog from '@/components/emom/ShareChallengeDialog';
import { toast } from 'sonner';
import { Loader2, Swords, Share2, RotateCcw, Users } from 'lucide-react';

type View = 'loading' | 'missing' | 'brief' | 'workout' | 'result';

export default function Challenge() {
  const { challengeId = '' } = useParams();
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState<PublicChallenge | null>(null);
  const [view, setView] = useState<View>('loading');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [newChallengeId, setNewChallengeId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);


  useEffect(() => {
    let cancelled = false;
    setView('loading');
    getPublicChallenge(challengeId)
      .then(c => {
        if (cancelled) return;
        setChallenge(c);
        setView(c ? 'brief' : 'missing');
      })
      .catch(() => { if (!cancelled) setView('missing'); });
    return () => { cancelled = true; };
  }, [challengeId]);

  const exercise = challenge ? getExerciseById(challenge.exerciseId) : null;
  const myName = authProfile?.name || 'Athlete';

  const handleAccept = async () => {
    if (!user) {
      // Preserve challenge context across sign-up/sign-in, then return right here.
      setPostAuthRedirect(`/challenge/${challengeId}`);
      navigate('/auth');
      return;
    }
    setStarting(true);
    try {
      await startChallengeAttempt(challengeId);
      setView('workout');
    } catch {
      toast.error('Could not start the attempt. Try again.');
    } finally {
      setStarting(false);
    }
  };

  const handleComplete = async (session: WorkoutSession) => {
    try {
      if (user) {
        await pushSession(user.id, session);
        setLastSessionId(session.id);
        const res = await completeChallengeAttempt(challengeId, session.id);
        setResult(res);
      } else {
        // Signed-out visitors can still play — shown outcome is derived locally
        // from the stored creator score; nothing is persisted.
        const total = session.sets.reduce((s, st) => s + (st.actualReps || 0), 0);
        setResult({
          outcome: total > (challenge?.creatorTotalReps ?? 0) ? 'won' : total < (challenge?.creatorTotalReps ?? 0) ? 'lost' : 'tied',
          creatorTotalReps: challenge?.creatorTotalReps ?? 0,
          participantTotalReps: total,
          creatorDisplayName: challenge?.creatorDisplayName ?? 'Athlete',
        });
      }
      setView('result');
    } catch {
      toast.error('Could not save your result. Check your connection and try again.');
    }
  };


  // Rematch: same challenge, one more attempt.
  const handleRematch = () => {
    setResult(null);
    setView('brief');
  };

  // "Challenge Someone Else": publish MY result as a brand-new immutable challenge.
  const handleChallengeSomeoneElse = async () => {
    if (!user || !lastSessionId) return;
    try {
      const { createChallengeFromSession } = await import('@/lib/challenges');
      const id = await createChallengeFromSession(lastSessionId, challengeId);
      setNewChallengeId(id);
    } catch {
      toast.error('Could not create the new challenge.');
    }
  };



  // --- LOADING / MISSING ---
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (view === 'missing') {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto text-center pt-20">
        <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground">Challenge not found</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">This link may have been mistyped.</p>
        <Button onClick={() => navigate('/')} className="bg-primary text-primary-foreground">Go to Muscle Max</Button>
      </div>
    );
  }

  if (!challenge) return null;

  // --- WORKOUT ---
  if (view === 'workout') {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
        <EmomTimer
          exerciseId={challenge.exerciseId}
          phase="baseline"
          prescription={challenge.prescription.length === 10 ? challenge.prescription : Array(10).fill(12)}
          isChallenge
          onComplete={handleComplete}
          onCancel={() => setView('brief')}
        />
      </div>
    );
  }

  // --- RESULT ---
  if (view === 'result' && result) {
    const headline = result.outcome === 'won' ? 'YOU WON!' : result.outcome === 'lost' ? 'YOU LOST' : 'TIED!';
    const headlineColor = result.outcome === 'won' ? 'text-primary' : result.outcome === 'lost' ? 'text-destructive' : 'text-foreground';
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
        <div className="text-center py-6">
          <h1 className={`text-4xl font-black tracking-tight ${headlineColor}`}>{headline}</h1>
          <p className="text-xs text-muted-foreground mt-1">10-Minute {exercise?.name} EMOM</p>
        </div>

        <Card className="border-border mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground truncate pr-2">
                {result.creatorDisplayName} (challenger)
              </span>
              <span className="text-2xl font-black text-foreground">{result.creatorTotalReps}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-primary truncate pr-2">You</span>
              <span className="text-2xl font-black text-primary">{result.participantTotalReps}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button onClick={handleRematch} variant="outline" className="gap-2 border-primary/40">
            <RotateCcw className="w-4 h-4" /> Rematch
          </Button>
          <Button onClick={handleChallengeSomeoneElse} disabled={!user || !lastSessionId} className="gap-2 bg-primary text-primary-foreground">
            <Users className="w-4 h-4" /> Challenge Someone Else
          </Button>
        </div>
        {!user && (
          <p className="text-xs text-muted-foreground text-center mb-4">
            Sign in to save results and challenge others with your score.
          </p>
        )}

        <Button
          onClick={() => shareChallenge({
            title: 'Muscle Max Friend Challenge',
            text: `${result.creatorDisplayName} hit ${result.creatorTotalReps} reps. Can you beat it?`,
            url: challengeUrl(challengeId),
          }).then(r => { if (r === 'copied') toast.success('Link copied'); })}
          variant="secondary"
          className="w-full gap-2"
        >
          <Share2 className="w-4 h-4" /> Share this challenge
        </Button>

        <ShareChallengeDialog
          challengeId={newChallengeId}
          fallbackName={myName}
          fallbackExerciseId={challenge.exerciseId}
          fallbackReps={result.participantTotalReps}
          onClose={() => setNewChallengeId(null)}
        />
      </div>
    );
  }

  // --- BRIEF (public, viewable without an account) ---
  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      <div className="text-center py-6">
        <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-2">Friend Challenge</p>
        <h1 className="text-2xl font-bold text-foreground">
          {challenge.creatorDisplayName} challenged you
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {challenge.creatorDisplayName} hit <span className="font-bold text-primary">{challenge.creatorTotalReps} reps</span> in a
          10-minute {exercise?.name} EMOM. Beat it.
        </p>
      </div>

      <Card className="border-primary/30 mb-4">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-3">The exact workout, preloaded:</p>
          <div className="grid grid-cols-10 gap-1 mb-3">
            {(challenge.prescription.length === 10 ? challenge.prescription : Array(10).fill(12)).map((reps, i) => (
              <div key={i} className="text-center rounded py-1 bg-secondary text-xs font-mono font-bold text-foreground">
                {reps === -1 ? '🔥' : reps}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{exercise?.icon} {exercise?.name}</span>
            <span>Score to beat: <span className="font-bold text-primary">{challenge.creatorTotalReps}</span></span>
          </div>
        </CardContent>
      </Card>

      {challenge.attemptCount > 0 && (
        <p className="text-xs text-muted-foreground text-center mb-4">
          {challenge.attemptCount} {challenge.attemptCount === 1 ? 'person has' : 'people have'} attempted this challenge
        </p>
      )}

      <Button onClick={handleAccept} disabled={starting || authLoading} className="w-full bg-primary text-primary-foreground py-6 text-lg gap-2">
        {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Swords className="w-5 h-5" />}
        {user ? 'Accept Challenge' : 'Sign in to Accept'}
      </Button>
      {!user && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          You'll come straight back here after signing in.
        </p>
      )}
    </div>
  );
}
