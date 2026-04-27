import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Droplets, Clock, Flame, Activity, Sparkles, Wallet, ShieldCheck, Zap, Beaker } from 'lucide-react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { useSubscriptionStats } from '@/lib/useStats';
import { liquidityApi } from '@/lib/api';
import { timeAgo, shortAddr } from '@/lib/format';
import { toast } from 'sonner';

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

export function LiquiditySupportTracker({ className = '', showAdmin = false }) {
  const { stats, loading, refresh } = useSubscriptionStats(15000);
  const cd = useCountdown(stats?.next_support_cycle_at);
  const [running, setRunning] = useState(false);
  const [engineStatus, setEngineStatus] = useState(null);

  useEffect(() => {
    liquidityApi.status().then(({ data }) => setEngineStatus(data)).catch(() => {});
  }, []);

  const allocation = stats?.allocation;
  const xemaXrp = allocation?.xema_support_xrp ?? 0;
  const opsXrp = allocation?.ops_growth_xrp ?? 0;
  const xemaPct = allocation?.xema_pct ?? 65;
  const opsPct = allocation?.ops_pct ?? 35;
  const isDryRun = stats?.dry_run ?? engineStatus?.dry_run ?? true;
  const community = stats?.community_wallet || engineStatus?.community_wallet;

  const triggerRun = async () => {
    setRunning(true);
    try {
      const { data } = await liquidityApi.runNow({ force: true });
      toast.success(
        data?.dry_run
          ? `DRY RUN: would send ${data.allocated_xema_xrp} XRP to XEMA AMM`
          : `Live tx ${data.tx_hash?.slice(0, 10)}…`,
      );
      const refreshed = await liquidityApi.status();
      setEngineStatus(refreshed.data);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card
      data-testid="liquidity-support-tracker"
      className={`relative overflow-hidden rounded-2xl glass-card neon-orange p-5 ${className}`}
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-16 opacity-20">
        <Droplets className="h-48 w-48 text-[hsl(var(--phoenix-orange))]" strokeWidth={0.6} />
      </div>

      <div className="relative flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-[hsl(var(--phoenix-orange))]" />
          <div className="font-display text-sm uppercase tracking-widest text-white">
            Liquidity Support Tracker
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDryRun && (
            <Badge
              data-testid="liquidity-dry-run-badge"
              className="font-display text-[10px] uppercase tracking-widest border bg-[hsl(var(--alerts-magenta))]/15 text-[hsl(var(--alerts-magenta))] border-[hsl(var(--alerts-magenta))]/40"
            >
              <Beaker className="h-3 w-3 mr-1" /> Dry Run
            </Badge>
          )}
          <Badge
            data-testid="liquidity-tracker-cycle-badge"
            className="bg-[hsl(var(--phoenix-orange))]/15 text-[hsl(var(--phoenix-orange))] border border-[hsl(var(--phoenix-orange))]/40 font-display text-[10px] uppercase tracking-widest"
          >
            {stats?.next_support_cycle || 'Sunday 8:00 PM'}
          </Badge>
        </div>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Weekly XRP + allocation breakdown */}
        <div
          data-testid="liquidity-weekly-collected"
          className="rounded-xl bg-black/40 border border-white/10 p-4 md:col-span-1"
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
          {/* Allocation split: 65/35 */}
          <div
            data-testid="liquidity-allocation-bar"
            className="mt-3 h-2 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden flex"
            role="progressbar"
            aria-valuenow={xemaPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-gradient-to-r from-[hsl(var(--phoenix-orange))] to-[hsl(40_100%_60%)]"
              style={{ width: `${xemaPct}%` }}
              data-testid="liquidity-allocation-bar-xema"
            />
            <div
              className="h-full bg-gradient-to-r from-[hsl(var(--electric-blue))] to-[hsl(220_70%_60%)]"
              style={{ width: `${opsPct}%` }}
              data-testid="liquidity-allocation-bar-ops"
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]" data-testid="liquidity-allocation-breakdown">
            <div className="rounded-lg bg-[hsl(var(--phoenix-orange))]/10 border border-[hsl(var(--phoenix-orange))]/30 px-2 py-1.5">
              <div className="text-[hsl(var(--phoenix-orange))] font-display uppercase tracking-widest text-[10px]">
                XEMA support · {xemaPct}%
              </div>
              <div className="font-mono text-white tabular-nums">
                <AnimatedCounter
                  value={xemaXrp}
                  decimals={2}
                  suffix=" XRP"
                  glowColor="rgba(255, 107, 26, 0.5)"
                />
              </div>
            </div>
            <div className="rounded-lg bg-[hsl(var(--electric-blue))]/10 border border-[hsl(var(--electric-blue))]/30 px-2 py-1.5">
              <div className="text-[hsl(var(--electric-blue))] font-display uppercase tracking-widest text-[10px]">
                Ops / growth · {opsPct}%
              </div>
              <div className="font-mono text-white tabular-nums">
                <AnimatedCounter
                  value={opsXrp}
                  decimals={2}
                  suffix=" XRP"
                  glowColor="rgba(0, 212, 255, 0.5)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div data-testid="liquidity-countdown" className="rounded-xl bg-black/40 border border-white/10 p-4">
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
          <div className="text-[11px] text-muted-foreground mt-2">
            Auto-injection into XEMA AMM
          </div>
          {showAdmin && (
            <Button
              onClick={triggerRun}
              disabled={running}
              data-testid="liquidity-run-now-button"
              size="sm"
              className="mt-3 w-full rounded-lg bg-[hsl(var(--phoenix-orange))] text-black hover:brightness-110 font-display uppercase tracking-widest text-[10px]"
            >
              <Zap className="h-3 w-3 mr-1" /> {running ? 'Running…' : 'Run Cycle Now'}
            </Button>
          )}
        </div>

        {/* Last support action + community wallet */}
        <div data-testid="liquidity-last-action" className="rounded-xl bg-black/40 border border-white/10 p-4">
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
                {timeAgo(stats.last_support_action.timestamp)} · {stats.last_support_action.action_type?.replace(/_/g, ' ')}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground mt-2">No support actions yet.</div>
          )}
          {community && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2" data-testid="liquidity-community-wallet">
              <Wallet className="h-3.5 w-3.5 text-[hsl(var(--phoenix-orange))]" />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  Community wallet
                </div>
                <div className="font-mono text-[11px] text-white/80 truncate">
                  {shortAddr(community)}
                </div>
              </div>
              <a
                href={`https://livenet.xrpl.org/accounts/${community}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[hsl(var(--electric-blue))] underline whitespace-nowrap"
                data-testid="liquidity-community-wallet-link"
              >
                Explorer →
              </a>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="relative mt-3 text-[10px] text-muted-foreground">Refreshing…</div>
      )}
    </Card>
  );
}
