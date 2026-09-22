import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth, takePostAuthRedirect, peekPostAuthRedirect } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function Auth() {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithProvider } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const pendingRedirect = peekPostAuthRedirect();

  // Signed in → go straight back to wherever the user was headed (e.g. a challenge).
  useEffect(() => {
    if (!loading && user) {
      navigate(takePostAuthRedirect() || '/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (error) toast.error(error);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error, needsConfirmation } = await signUpWithEmail(email.trim(), password, displayName.trim());
    setBusy(false);
    if (error) return toast.error(error);
    if (needsConfirmation) toast.success('Check your email to confirm your account.');
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await signInWithProvider('google');
    setBusy(false);
    if (error) toast.error(error);
  };

  return (
    <div className="min-h-dvh min-w-0 bg-background p-4 max-w-md mx-auto [overflow-wrap:anywhere]">
      <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-4 min-h-11 text-muted-foreground">
        <ArrowLeft className="w-4 h-4 shrink-0 mr-1" /> Back
      </Button>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight leading-tight text-foreground">Muscle Max Account</h1>
        <p className="text-sm leading-relaxed text-muted-foreground mt-2">
          {pendingRedirect?.startsWith('/challenge/')
            ? 'Sign in to take this challenge — we\'ll bring you right back to it.'
            : 'Keep your progress, XP and streak on every device. Training works without an account too.'}
        </p>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-4">
          <Button onClick={handleGoogle} disabled={busy} variant="outline" className="w-full mb-4 h-auto min-h-11">
            Continue with Google
          </Button>

          <Tabs defaultValue="signin">
            <TabsList className="grid h-auto w-full grid-cols-2 mb-4 gap-1 items-stretch">
              <TabsTrigger value="signin" className="min-w-0 min-h-11 whitespace-normal px-2 py-2 leading-snug">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="min-w-0 min-h-11 whitespace-normal px-2 py-2 leading-snug">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="si-pass">Password</Label>
                  <Input id="si-pass" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="su-name">Display name</Label>
                  <Input id="su-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Michael" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="su-pass">Password</Label>
                  <Input id="su-pass" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
