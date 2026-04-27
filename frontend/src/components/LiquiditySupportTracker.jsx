import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplets, Clock, Flame, Activity, Sparkles } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { useSubscriptionStats } from '@/lib/useStats';
import { timeAgo } from '@/lib/format';

function useCountdown(targetIso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!targetIso) return { d: 0, h: 0, m: 0, s: 0, done: true };
  const target = new Date(targetIso).getTime();
  let diff = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.floor(diff / 86400);
  diff -= d * 86400;
  const h = Math.floor(diff / 3600);
  diff -= h * 3600;
  const m = Math.floor(diff / 60);
  const s = diff - m * 60;
  return { d, h, m, s, done: target - now <= 0 };
}

export function LiquiditySupportTracker({ className = '' }) {
  const { stats, loading } = useSubscriptionStats(20000);
  const cd = useCountdown(stats?.next_support_cycle_at);

  return (
    <Card
      data-testid="liquidity-support-tracker"
      className={`relative overflow-hidden rounded-2xl glass-card neon-orange p-5 ${className}`}
    >
      {/* decorative glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-16 opacity-20"
      >
        <Droplets className="h-48 w-48 text-[hsl(var(--phoenix-orange))]" strokeWidth={0.6} />
      </div>

      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-[hsl(var(--phoenix-orange))]" />
          <div className="font-display text-sm uppercase tracking-widest text-white">
            Liquidity Support Tracker
          </div>
        </div>
        <Badge
          data-testid="liquidity-tracker-cycle-badge"
          className="bg-[hsl(var(--phoenix-orange))]/15 text-[hsl(var(--phoenix-orange))] border border-[hsl(var(--phoenix-orange))]/40 font-display text-[10px] uppercase tracking-widest"
        >
          {stats?.next_support_cycle || 'Sunday 8:00 PM'}
        </Badge>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Weekly XRP */}
        <div
          data-testid="liquidity-weekly-collected"
          className="rounded-xl bg-black/40 border border-white/10 p-4"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Flame className="h-3 w-3 text-[hsl(var(--phoenix-orange))]" />
            Weekly XRP collected
          </div>
          <div className="mt-2 font-display text-3xl text-white">
            <AnimatedCounter
              testId="liquidity-weekly-counter"
              value={stats?.weekly_xrp_collected || 0}
              decimals={2}
              suffix=" XRP"
              className="neon-text-orange"
              glowColor="rgba(255, 107, 26, 0.6)"
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            From paid subscriptions in the last 7 days
          </div>
        </div>

        {/* Countdown */}
        <div
          data-testid="liquidity-countdown"
          className="rounded-xl bg-black/40 border border-white/10 p-4"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Clock className="h-3 w-3 text-[hsl(var(--electric-blue))]" />
            Next support cycle
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[
              { lbl: 'd', val: cd.d },
              { lbl: 'h', val: cd.h },
              { lbl: 'm', val: cd.m },
              { lbl: 's', val: cd.s },
            ].map((u) => (
              <div
                key={u.lbl}
                className="rounded-lg bg-white/[0.04] border border-white/10 py-1.5 text-center"
              >
                <div className="font-display text-lg text-white tabular-nums leading-none">
                  {String(u.val).padStart(2, '0')}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">
                  {u.lbl}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Auto-injection into XEMA AMM
          </div>
        </div>

        {/* Last support action */}
        <div
          data-testid="liquidity-last-action"
          className="rounded-xl bg-black/40 border border-white/10 p-4"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3 w-3 text-emerald-400" />
            Last support action
          </div>
          {stats?.last_support_action ? (
            <>
              <div className="mt-2 font-display text-2xl text-white">
                <AnimatedCounter
                  testId="liquidity-last-amount"
                  value={stats.last_support_action.amount_xrp}
                  decimals={2}
                  suffix=" XRP"
                  glowColor="rgba(52, 211, 153, 0.55)"
                />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1" data-testid="liquidity-last-timestamp">
                {timeAgo(stats.last_support_action.timestamp)} · {stats.last_support_action.action_type?.replace('_', ' ')}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground mt-2">No support actions yet.</div>
          )}
        </div>
      </div>

      {loading && (
        <div className="relative mt-3 text-[10px] text-muted-foreground">Refreshing…</div>
      )}
    </Card>
  );
}
