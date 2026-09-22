import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share2, Copy, Check } from 'lucide-react';
import { challengeUrl, copyLink, shareChallenge, canNativeShare } from '@/lib/share';
import { getPublicChallenge } from '@/lib/challenges';
import { toast } from 'sonner';
import ChallengeResultCard from './ChallengeResultCard';

interface ShareChallengeDialogProps {
  challengeId: string | null;
  /** Fallbacks used only until the server's canonical challenge data loads. */
  fallbackName?: string;
  fallbackExerciseId?: string;
  fallbackReps?: number;
  onClose: () => void;
}

export default function ShareChallengeDialog({
  challengeId, fallbackName, fallbackExerciseId, fallbackReps, onClose,
}: ShareChallengeDialogProps) {
  const [copied, setCopied] = React.useState(false);
  const [server, setServer] = React.useState<{
    displayName: string;
    exerciseId: string;
    totalReps: number;
  } | null>(null);

  // Always render the card from the server's immutable challenge record —
  // the creator score lives there, not in local summary state.
  React.useEffect(() => {
    if (!challengeId) {
      setServer(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const c = await getPublicChallenge(challengeId);
        if (!cancelled && c) {
          setServer({
            displayName: c.creatorDisplayName,
            exerciseId: c.exerciseId,
            totalReps: c.creatorTotalReps,
          });
        }
      } catch {
        // Keep fallbacks; the URL and sharing still work.
      }
    })();
    return () => { cancelled = true; };
  }, [challengeId]);

  const displayName = server?.displayName ?? fallbackName ?? 'Athlete';
  const exerciseId = server?.exerciseId ?? fallbackExerciseId ?? 'regular_pushup';
  const totalReps = server?.totalReps ?? fallbackReps ?? 0;
  const url = challengeId ? challengeUrl(challengeId) : '';

  const handleShare = async () => {
    const result = await shareChallenge({
      title: 'Muscle Max Friend Challenge',
      text: `${displayName} hit ${totalReps} reps. Can you beat it?`,
      url,
    });
    if (result === 'copied') {
      setCopied(true);
      toast.success('Link copied');
    } else if (result === 'failed') {
      toast.error('Could not share the link');
    }
  };

  const handleCopy = async () => {
    const ok = await copyLink(url);
    setCopied(ok);
    if (ok) toast.success('Link copied');
    else toast.error('Could not copy the link');
  };

  return (
    <Dialog open={!!challengeId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm min-w-0">
        <DialogHeader>
          <DialogTitle>Friend Challenge created</DialogTitle>
        </DialogHeader>
        <ChallengeResultCard displayName={displayName} exerciseId={exerciseId} totalReps={totalReps} />
        <div className="min-w-0 rounded bg-secondary px-3 py-2 text-[11px] font-mono text-muted-foreground break-all">
          {url}
        </div>
        <div className="flex min-w-0 flex-wrap items-stretch gap-2">
          <Button onClick={handleShare} className="h-auto min-h-11 min-w-0 flex-1 basis-40 whitespace-normal bg-primary text-primary-foreground gap-2">
            <Share2 className="w-4 h-4" /> <span className="min-w-0">{canNativeShare() ? 'Share' : 'Copy link'}</span>
          </Button>
          <Button onClick={handleCopy} variant="outline" aria-label={copied ? 'Link copied' : 'Copy challenge link'} className="h-auto min-h-11 min-w-11 flex-1 basis-11 px-3">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
