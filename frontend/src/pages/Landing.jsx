import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/TopNav';
import { XamanLoginButton } from '@/components/XamanLoginButton';
import { TierCard } from '@/components/TierCard';
import { LiveAlertsPanel } from '@/components/LiveAlertsPanel';
import { RanksGrid } from '@/components/RankCard';
import { Button } from '@/components/ui/button';
import { Flame, Zap, Shield, ChevronDown } from 'lucide-react';
import { subsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Landing() {
  const [plans, setPlans] = useState([]);
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    subsApi.plans().then(({ data }) => setPlans(data || [])).catch(() => setPlans([]));
  }, []);

  const goSubscribe = () => {
    if (!user) {
      document.querySelector('[data-testid="xaman-login-button"]')?.click();
    } else {
      nav('/subscribe');
    }
  };

  return (
    <div className="relative bg-cinematic min-h-screen noise-overlay overflow-hidden">
      <div className="ember-corner-left ember-flicker" />
      <div className="ember-corner-right ember-flicker" />
      <TopNav />

      <main className="relative max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-12 space-y-10">
        {/* HERO */}
        <section className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 glass-card neon-orange rounded-3xl p-6 sm:p-10 relative overflow-hidden" data-testid="hero-section">
            <div className="absolute -right-24 -bottom-32 opacity-30 pointer-events-none flame-bob select-none">
              <Flame className="h-[320px] w-[320px] text-[hsl(var(--phoenix-orange))]" strokeWidth={1} />
            </div>
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--phoenix-orange))] pulse-glow" />
                XRPL Premium Terminal · V1.0
              </div>
              <h1 className="font-display mt-4 text-4xl sm:text-6xl lg:text-7xl font-bold leading-[0.95]">
                <span className="shimmer-title">XRPL</span>
                <br />
                <span className="text-white">Universal</span>{' '}
                <span className="text-[hsl(var(--phoenix-orange))]">Money</span>{' '}
                <span className="text-[hsl(var(--electric-blue))]">Machine</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm sm:text-base text-muted-foreground">
                Tracking liquidity, buys & whale movement on XRPL. Track smarter. Act faster. Stay ahead.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {user ? (
                  <Button
                    onClick={() => nav('/dashboard')}
                    data-testid="hero-open-dashboard"
                    className="rounded-xl bg-[hsl(var(--phoenix-orange))] hover:brightness-110 active:scale-[0.98] text-black font-semibold px-6 py-5 neon-orange"
                  >
                    <Zap className="mr-2 h-4 w-4" /> Open Dashboard
                  </Button>
                ) : (
                  <XamanLoginButton />
                )}
                <Button
                  onClick={goSubscribe}
                  variant="secondary"
                  data-testid="hero-see-plans"
                  className="rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] px-6 py-5"
                >
                  See Plans <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { t: 'Whale detection', c: 'text-[hsl(var(--phoenix-orange))]' },
                  { t: 'Liquidity surges', c: 'text-emerald-300' },
                  { t: 'Shark sell pressure', c: 'text-[hsl(var(--neon-red))]' },
                  { t: 'Real-time pushes', c: 'text-[hsl(var(--electric-blue))]' },
                ].map((b) => (
                  <span
                    key={b.t}
                    className={`text-[10px] uppercase tracking-widest border border-white/10 bg-white/[0.04] rounded-full px-3 py-1 ${b.c}`}
                  >
                    {b.t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 min-h-[520px]">
            <LiveAlertsPanel />
          </div>
        </section>

        {/* TIERS */}
        <section id="plans" className="space-y-3">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Subscription</div>
              <h2 className="font-display text-2xl sm:text-3xl">Pick your access</h2>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" /> Paid via Xaman XRP payment · cancel anytime
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 lg:gap-6">
            {plans.map((p) => (
              <TierCard key={p.id} tier={p} onSelect={goSubscribe} />
            ))}
          </div>
        </section>

        {/* RANKS PREVIEW */}
        <section className="space-y-3">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Intelligence</div>
              <h2 className="font-display text-2xl sm:text-3xl">AMM holder & buyer ranks</h2>
            </div>
            <div className="text-xs text-muted-foreground">
              Classify wallets by XRP balance. Sign in to configure alerts per rank.
            </div>
          </div>
          {user ? (
            <RanksGrid compact />
          ) : (
            <div className="rounded-2xl glass-card p-6 text-center text-muted-foreground text-sm">
              Sign in with Xaman to manage your rank alerts ·
              <span className="mx-2 font-mono">Shrimp · Crab · Octopus · Shark · Humpback</span>
            </div>
          )}
        </section>

        <footer className="py-10 text-[11px] text-muted-foreground text-center space-x-4">
          <span>© {new Date().getFullYear()} XRPL Universal Money Machine</span>
          <span>·</span>
          <span>Not financial advice.</span>
          <span>·</span>
          <span>Xaman integration in mock mode — swap API keys to go live.</span>
        </footer>
      </main>
    </div>
  );
}
