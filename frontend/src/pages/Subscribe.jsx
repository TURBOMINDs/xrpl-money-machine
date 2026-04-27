import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/TopNav';
import { TierCard } from '@/components/TierCard';
import { SubscribePaymentModal } from '@/components/SubscribePaymentModal';
import { LiquiditySupportTracker } from '@/components/LiquiditySupportTracker';
import { TrustMessage } from '@/components/TrustMessage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Flame } from 'lucide-react';
import { toast } from 'sonner';
import { subsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSubscriptionStats } from '@/lib/useStats';

export default function Subscribe() {
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState(null);
  const [tier, setTier] = useState(null);
  const [open, setOpen] = useState(false);
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const { stats } = useSubscriptionStats(15000);

  useEffect(() => {
    subsApi.plans().then(({ data }) => setPlans(data || [])).catch(() => {});
  }, []);

  const startTrial = async () => {
    setBusy(true);
    try {
      await subsApi.startTrial();
      toast.success('3-day Basic trial started');
      await refresh();
      nav('/dashboard');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Trial unavailable');
    } finally {
      setBusy(false);
    }
  };

  const subscribe = async (t) => {
    setBusy(true);
    try {
      const { data } = await subsApi.subscribe(t.id);
      setTier(t);
      setIntent(data);
      setOpen(true);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Subscribe failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative bg-cinematic min-h-screen noise-overlay">
      <TopNav />
      <main className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Subscription</div>
          <h1 className="font-display text-3xl sm:text-4xl">Choose your access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All plans billed via Xaman XRP payment. Mock mode is active — simulate payment to instantly unlock.
          </p>
        </div>

        {me?.subscription && ['trial', 'active'].includes(me.subscription.status) ? (
          <Card className="rounded-2xl glass-card neon-blue p-4" data-testid="current-subscription">
            <div className="text-sm">
              You're on <strong className="uppercase text-[hsl(var(--electric-blue))]">{me.subscription.tier}</strong>
              {' '}({me.subscription.status}) with {me.slots_limit} tracking slots.
            </div>
          </Card>
        ) : (
          <Card className="rounded-2xl glass-card neon-orange p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3" data-testid="trial-card">
            <Flame className="h-5 w-5 text-[hsl(var(--phoenix-orange))]" />
            <div className="flex-1">
              <div className="font-display uppercase tracking-widest text-sm">3-day free Basic trial</div>
              <div className="text-xs text-muted-foreground">No payment needed. 5 AMM slots included.</div>
            </div>
            <Button
              disabled={busy}
              onClick={startTrial}
              data-testid="subscribe-start-trial"
              className="rounded-xl bg-[hsl(var(--phoenix-orange))] text-black font-display uppercase tracking-widest"
            >
              Start Trial
            </Button>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <TierCard
              key={p.id}
              tier={p}
              loading={busy}
              stats={stats}
              current={me?.subscription?.tier === p.id && ['trial', 'active'].includes(me?.subscription?.status || '')}
              onSelect={() => subscribe(p)}
            />
          ))}
        </div>

        <TrustMessage />
        <LiquiditySupportTracker />
      </main>
      <SubscribePaymentModal open={open} onOpenChange={setOpen} tier={tier} intent={intent} />
    </div>
  );
}
