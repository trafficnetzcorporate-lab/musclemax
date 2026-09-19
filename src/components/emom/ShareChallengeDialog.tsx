import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share2, Copy, Check } from 'lucide-react';
import { challengeUrl, copyLink, shareChallenge, canNativeShare } from '@/lib/share';
import { toast } from 'sonner';
import ChallengeResultCard from './ChallengeResultCard';

interface ShareChallengeDialogProps {
  challengeId: string | null;
  displayName: string;
  exerciseId: string;
  totalReps: number;
  onClose: () => void;
}

export default function ShareChallengeDialog({
  challengeId, displayName, exerciseId, totalReps, onClose,
}: ShareChallengeDialogProps) {
  const [copied, setCopied] = React.useState(false);
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
    ok ? toast.success('Link copied') : toast.error('Could not copy the link');
  };

  return (
    <Dialog open={!!challengeId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Friend Challenge created</DialogTitle>
        </DialogHeader>
        <ChallengeResultCard displayName={displayName} exerciseId={exerciseId} totalReps={totalReps} />
        <div className="rounded bg-secondary px-3 py-2 text-[11px] font-mono text-muted-foreground break-all">
          {url}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleShare} className="flex-1 bg-primary text-primary-foreground gap-2">
            <Share2 className="w-4 h-4" /> {canNativeShare() ? 'Share' : 'Copy link'}
          </Button>
          <Button onClick={handleCopy} variant="outline" className="gap-2">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
