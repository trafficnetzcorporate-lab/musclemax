import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
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
  const [appleBusy, setAppleBusy] = useState(false);
  const showAppleSignIn = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
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

  const handleApple = async () => {
    setBusy(true);
    setAppleBusy(true);
    try {
      const { error } = await signInWithProvider('apple');
      if (error) toast.error(error);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Apple sign-in failed. Please try again.');
    } finally {
      setAppleBusy(false);
      setBusy(false);
    }
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
          {showAppleSignIn && (
            <div className="mb-3">
              <Button
                type="button"
                onClick={handleApple}
                disabled={busy}
                aria-busy={appleBusy}
                className="w-full min-h-11 gap-0 bg-white p-0 pr-[8%] text-black hover:bg-white hover:text-black"
              >
                {/* Official Apple Design Resources artwork; preserve its 31×44 canvas and padding. */}
                <svg aria-hidden="true" focusable="false" viewBox="0 0 31 44" className="!h-11 !w-auto shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <rect width="31" height="44" fill="#FFFFFF" />
                  <path d="M15.7099491,14.8846154 C16.5675461,14.8846154 17.642562,14.3048315 18.28274,13.5317864 C18.8625238,12.8312142 19.2852829,11.852829 19.2852829,10.8744437 C19.2852829,10.7415766 19.2732041,10.6087095 19.2490464,10.5 C18.2948188,10.5362365 17.1473299,11.140178 16.4588366,11.9494596 C15.9152893,12.56548 15.4200572,13.5317864 15.4200572,14.5222505 C15.4200572,14.6671964 15.4442149,14.8121424 15.4562937,14.8604577 C15.5166879,14.8725366 15.6133185,14.8846154 15.7099491,14.8846154 Z M12.6902416,29.5 C13.8618881,29.5 14.3812778,28.714876 15.8428163,28.714876 C17.3285124,28.714876 17.6546408,29.4758423 18.9591545,29.4758423 C20.2395105,29.4758423 21.0971074,28.292117 21.9063891,27.1325493 C22.8123013,25.8038779 23.1867451,24.4993643 23.2109027,24.4389701 C23.1263509,24.4148125 20.6743484,23.4122695 20.6743484,20.5979021 C20.6743484,18.1579784 22.6069612,17.0588048 22.7156707,16.974253 C21.4353147,15.1382708 19.490623,15.0899555 18.9591545,15.0899555 C17.5217737,15.0899555 16.3501271,15.9596313 15.6133185,15.9596313 C14.8161157,15.9596313 13.7652575,15.1382708 12.521138,15.1382708 C10.1536872,15.1382708 7.75,17.0950413 7.75,20.7911634 C7.75,23.0861411 8.64383344,25.513986 9.74300699,27.0842339 C10.6851558,28.4129053 11.5065162,29.5 12.6902416,29.5 Z" fill="#000000" fillRule="nonzero" />
                </svg>
                <span className="min-w-0 flex-1 py-2 text-[1.1875rem] leading-tight">Sign in with Apple</span>
              </Button>
              {appleBusy && (
                <p role="status" className="mt-2 flex min-w-0 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="min-w-0">Opening Apple sign-in…</span>
                </p>
              )}
            </div>
          )}
          <Button onClick={handleGoogle} disabled={busy} variant="outline" className="w-full mb-4 h-auto min-h-11">
            Continue with Google
          </Button>

          <Tabs defaultValue="signin">
            <TabsList className="grid h-auto w-full grid-cols-[repeat(auto-fit,minmax(min(100%,6rem),1fr))] mb-4 gap-1 items-stretch">
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
