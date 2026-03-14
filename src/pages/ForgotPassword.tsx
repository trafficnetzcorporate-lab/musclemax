import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Flame, Mail, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Flame className="w-12 h-12 text-primary mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
        </div>
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            {sent ? (
              <div className="text-center space-y-3">
                <Mail className="w-10 h-10 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Check your email for a reset link.</p>
                <Link to="/auth" className="text-sm text-primary hover:underline">Back to login</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-secondary border-border"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <Link to="/auth" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary justify-center">
                  <ArrowLeft className="w-3 h-3" /> Back to login
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
