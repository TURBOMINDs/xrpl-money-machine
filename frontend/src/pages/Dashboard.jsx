import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/TopNav';
import { PairInputForm } from '@/components/PairInputForm';
import { LiveAlertsPanel } from '@/components/LiveAlertsPanel';
import { CandlestickChart } from '@/components/CandlestickChart';
import { RanksGrid } from '@/components/RankCard';
import { PriceAlertsModal } from '@/components/PriceAlertsModal';
import { TierCard } from '@/components/TierCard';
import { SubscribePaymentModal } from '@/components/SubscribePaymentModal';
import { LiquiditySupportTracker } from '@/components/LiquiditySupportTracker';
import { LiquidityExecutionLog } from '@/components/LiquidityExecutionLog';
import { TrustMessage } from '@/components/TrustMessage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Flame, Play, Pause, Trash2, BarChart3, Gauge } from 'lucide-react';
import { ammApi, subsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSubscriptionStats } from '@/lib/useStats';
import { formatXRP, formatUSD, shortAddr } from '@/lib/format';

export default function Dashboard() {
  const { me, refresh, user } = useAuth();
  const [pairs, setPairs] = useState([]);
  const [selectedPair, setSelectedPair] = useState(null);
  const [plans, setPlans] = useState([]);
  const [pendingIntent, setPendingIntent] = useState(null);
  const [paymentTier, setPaymentTier] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { stats } = useSubscriptionStats(15000);

  const loadPairs = async () => {
    const { data } = await ammApi.list();
    setPairs(data || []);
    if (!selectedPair && (data || []).length) setSelectedPair(data[0]);
    else if (selectedPair) {
      const found = (data || []).find((p) => p.id === selectedPair.id);
      if (!found) setSelectedPair((data || [])[0] || null);
    }
  };

  useEffect(() => {
    loadPairs().catch(() => {});
    subsApi.plans().then(({ data }) => setPlans(data || [])).catch(() => {});
  }, []);

  const hasSub = !!me?.subscription && ['trial', 'active'].includes(me.subscription.status);

  const startTrial = async () => {
    setBusy(true);
    try {
      await subsApi.startTrial();
      toast.success('3-day Basic trial started');
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to start trial');
    } finally {
      setBusy(false);
    }
  };

  const subscribe = async (tier) => {
    setBusy(true);
    try {
      const { data } = await subsApi.subscribe(tier.id);
      setPaymentTier(tier);
      setPendingIntent(data);
      setPayOpen(true);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to start subscription');
    } finally {
      setBusy(false);
    }
  };

  const togglePair = async (p) => {
    await ammApi.toggle(p.id);
    await loadPairs();
  };

  const removePair = async (p) => {
    if (!confirm(`Stop tracking ${p.pair_name || p.lp_address.slice(0, 10)}?`)) return;
    await ammApi.delete(p.id);
    await loadPairs();
    await refresh();
  };

  return (
    <div className="relative bg-cinematic min-h-screen noise-overlay">
      <div className="ember-corner-left ember-flicker" />
      <div className="ember-corner-right ember-flicker" />
      <TopNav />

      <main className="relative max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
        {/* subscription banner */}
        {!hasSub && (
          <Card className="rounded-2xl glass-card neon-orange p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3" data-testid="trial-banner">
            <Flame className="h-5 w-5 text-[hsl(var(--phoenix-orange))] shrink-0" />
            <div className="flex-1">
              <div className="font-display uppercase tracking-widest text-sm">Activate your access</div>
              <div className="text-xs text-muted-foreground">
                Start a 3-day free trial (Basic), or subscribe to Plus / Ultimate via Xaman to unlock more tracking slots and priority alerts.
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={startTrial}
                disabled={busy}
                data-testid="dashboard-start-trial"
                className="rounded-xl bg-[hsl(var(--phoenix-orange))] text-black font-display uppercase tracking-widest hover:brightness-110"
              >
                Start Free Trial
              </Button>
              <Button
                onClick={() => nav('/subscribe')}
                variant="secondary"
                data-testid="dashboard-view-plans"
                className="rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1]"
              >
                View Plans
              </Button>
            </div>
          </Card>
        )}

        {/* Main grid */}
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <PairInputForm
              onCreated={async () => { await loadPairs(); await refresh(); }}
              onOpenAlert={() => document.querySelector('[data-testid="price-alerts-open-modal"]')?.click()}
              slotsUsed={me?.slots_used || 0}
              slotsLimit={me?.slots_limit || 1}
            />

            {/* Selected pair + chart */}
            {selectedPair ? (
              <>
                <Card className="rounded-2xl glass-card p-4" data-testid="selected-pair-card">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="font-display uppercase tracking-widest text-sm text-white">
                        {selectedPair.pair_name || 'AMM Pair'}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {shortAddr(selectedPair.lp_address)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white/[0.04] border border-white/10 font-mono text-xs" data-testid="selected-pair-status">
                        {selectedPair.status}
                      </Badge>
                      <PriceAlertsModal pairId={selectedPair.id}>
                        <Button
                          data-testid="selected-pair-price-alerts"
                          className="rounded-xl bg-gradient-to-br from-[hsl(var(--alerts-magenta))] to-[hsl(var(--alerts-violet))] text-white font-semibold hover:brightness-110"
                        >
                          Price Alerts
                        </Button>
                      </PriceAlertsModal>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Reserve (XRP)" value={formatXRP(selectedPair.reserve_asset1)} />
                    <Stat label={`Reserve (${selectedPair.asset2_code || 'Token'})`} value={formatXRP(selectedPair.reserve_asset2)} />
                    <Stat label="LP Supply" value={formatXRP(selectedPair.lp_token_supply)} />
                    <Stat label="Fee (bps)" value={selectedPair.trading_fee_bps ?? '—'} />
                  </div>
                </Card>

                <CandlestickChart pairId={selectedPair.id} />
              </>
            ) : (
              <Card className="rounded-2xl glass-card p-6 text-center text-sm text-muted-foreground">
                No pairs tracked yet. Paste an XRPL AMM / LP address above to begin.
              </Card>
            )}

            {/* Pair list */}
            {pairs.length > 0 && (
              <Card className="rounded-2xl glass-card p-4" data-testid="pairs-list">
                <div className="flex items-center justify-between">
                  <div className="font-display uppercase tracking-widest text-sm">Your tracked pairs</div>
                  <div className="text-xs text-muted-foreground">{pairs.length} / {me?.slots_limit || 0}</div>
                </div>
                <ul className="mt-3 divide-y divide-white/5">
                  {pairs.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2" data-testid="pairs-list-item">
                      <button
                        onClick={() => setSelectedPair(p)}
                        className={`text-left flex-1 rounded-lg px-2 py-2 transition ${selectedPair?.id === p.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-3.5 w-3.5 text-[hsl(var(--electric-blue))]" />
                          <span className="font-display uppercase text-xs tracking-widest">{p.pair_name || 'Pair'}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{shortAddr(p.lp_address)}</span>
                          <Badge className="ml-auto text-[10px] bg-transparent border border-white/10">{p.status}</Badge>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePair(p)}
                        data-testid="pairs-list-toggle"
                        title={p.status === 'active' ? 'Pause' : 'Resume'}
                      >
                        {p.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePair(p)}
                        data-testid="pairs-list-remove"
                      >
                        <Trash2 className="h-4 w-4 text-[hsl(var(--neon-red))]" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Compact 5-card ranks */}
            <section className="space-y-2" data-testid="dashboard-ranks-compact">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Whale intelligence</div>
                  <h3 className="font-display text-lg sm:text-xl">AMM holder & buyer ranks</h3>
                </div>
              </div>
              <RanksGrid compact />
            </section>

            {/* Extended 8-card ranks */}
            <section className="space-y-2" data-testid="dashboard-ranks-full">
              <div className="flex items-end justify-between">
                <h3 className="font-display text-lg sm:text-xl">Rank alert preferences</h3>
                <div className="text-xs text-muted-foreground">Configure which rank tiers trigger alerts.</div>
              </div>
              <RanksGrid />
            </section>
          </div>

          <div className="lg:col-span-4 min-h-[640px]">
            <LiveAlertsPanel
              authed
              onViewAll={() => nav('/alerts')}
            />
          </div>
        </div>

        {!hasSub && (
          <section className="space-y-3">
            <h3 className="font-display text-lg sm:text-xl">Unlock more slots</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((p) => (
                <TierCard key={p.id} tier={p} onSelect={() => subscribe(p)} stats={stats} />
              ))}
            </div>
            <TrustMessage className="mt-3" />
          </section>
        )}

        {/* Liquidity Support Tracker (shown to all logged-in users) */}
        <LiquiditySupportTracker showAdmin />
        <LiquidityExecutionLog />
      </main>

      <SubscribePaymentModal
        open={payOpen}
        onOpenChange={setPayOpen}
        tier={paymentTier}
        intent={pendingIntent}
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-3" data-testid="pair-stat">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-base text-white tabular-nums">{value}</div>
    </div>
  );
}
