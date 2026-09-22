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
      <div className="min-h-dvh min-w-0 bg-background [overflow-wrap:anywhere] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (view === 'missing') {
    return (
      <div className="min-h-dvh min-w-0 bg-background [overflow-wrap:anywhere] p-4 max-w-lg mx-auto text-center pt-20">
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
      <div className="min-h-dvh min-w-0 bg-background [overflow-wrap:anywhere] p-4 max-w-lg mx-auto">
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
      <div className="min-h-dvh min-w-0 bg-background [overflow-wrap:anywhere] p-4 max-w-lg mx-auto">
        <div className="text-center py-6">
          <h1 className={`text-4xl font-black leading-tight tracking-tight ${headlineColor}`}>{headline}</h1>
          <p className="text-xs text-muted-foreground mt-1">10-Minute {exercise?.name} EMOM</p>
        </div>

        <Card className="border-border mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <span className="min-w-0 flex-1 basis-36 text-sm leading-relaxed text-muted-foreground">
                {result.creatorDisplayName} (challenger)
              </span>
              <span className="min-w-0 text-2xl font-black tabular-nums leading-tight text-foreground">{result.creatorTotalReps}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <span className="min-w-0 flex-1 basis-36 text-sm font-semibold text-primary">You</span>
              <span className="min-w-0 text-2xl font-black tabular-nums leading-tight text-primary">{result.participantTotalReps}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2 mb-4">
          <Button onClick={handleRematch} variant="outline" className="h-auto min-h-11 gap-2 py-3 border-primary/40">
            <RotateCcw className="w-4 h-4 shrink-0" /> Rematch
          </Button>
          <Button onClick={handleChallengeSomeoneElse} disabled={!user || !lastSessionId} className="h-auto min-h-11 gap-2 py-3 bg-primary text-primary-foreground">
            <Users className="w-4 h-4 shrink-0" /> Challenge Someone Else
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
          className="h-auto min-h-11 w-full gap-2 py-3"
        >
          <Share2 className="w-4 h-4 shrink-0" /> Share this challenge
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
    <div className="min-h-dvh min-w-0 bg-background [overflow-wrap:anywhere] p-4 max-w-lg mx-auto">
      <div className="text-center py-6">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase mb-2">Friend Challenge</p>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
          {challenge.creatorDisplayName} challenged you
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground mt-2">
          {challenge.creatorDisplayName} hit <span className="font-bold text-primary">{challenge.creatorTotalReps} reps</span> in a
          10-minute {exercise?.name} EMOM. Beat it.
        </p>
      </div>

      <Card className="border-primary/30 mb-4">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-3">The exact workout, preloaded:</p>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 mb-3">
            {(challenge.prescription.length === 10 ? challenge.prescription : Array(10).fill(12)).map((reps, i) => (
              <div key={i} aria-label={`Minute ${i + 1}: ${reps === -1 ? 'max reps' : `${reps} reps`}`} className="min-w-0 text-center rounded py-2 bg-secondary text-xs font-mono font-bold tabular-nums text-foreground">
                {reps === -1 ? '🔥' : reps}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
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

      <Button onClick={handleAccept} disabled={starting || authLoading} className="h-auto min-h-14 w-full bg-primary text-primary-foreground py-4 text-base gap-2">
        {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Swords className="w-5 h-5 shrink-0" />}
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
