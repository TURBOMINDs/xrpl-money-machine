import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Beaker, AlertTriangle, CheckCircle2, RefreshCcw, Hash } from 'lucide-react';
import { liquidityApi } from '@/lib/api';
import { timeAgo, shortAddr } from '@/lib/format';
import { toast } from 'sonner';

const STATUS_VIS = {
  dry_run: { Icon: Beaker, color: 'text-[hsl(var(--alerts-magenta))]', label: 'Dry Run' },
  success: { Icon: CheckCircle2, color: 'text-emerald-400', label: 'Success' },
  submitted: { Icon: Zap, color: 'text-[hsl(var(--phoenix-orange))]', label: 'Submitted' },
  failed: { Icon: AlertTriangle, color: 'text-[hsl(var(--neon-red))]', label: 'Failed' },
  pending: { Icon: RefreshCcw, color: 'text-muted-foreground', label: 'Pending' },
  skipped: { Icon: AlertTriangle, color: 'text-muted-foreground', label: 'Skipped' },
};

export function LiquidityExecutionLog({ className = '', limit = 10 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const { data } = await liquidityApi.executions(limit);
      setItems(data?.items || []);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, []);

  const runNow = async () => {
    setBusy(true);
    try {
      const { data } = await liquidityApi.runNow({ force: true });
      toast.success(
        data?.dry_run
          ? `Dry run executed (${data.allocated_xema_xrp} XRP would go to XEMA)`
          : `Cycle ${data.status} — tx ${data.tx_hash?.slice(0, 10)}…`,
      );
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to run cycle');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      data-testid="liquidity-execution-log"
      className={`rounded-2xl glass-card border-white/10 p-5 ${className}`}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[hsl(var(--phoenix-orange))]" />
          <div className="font-display text-sm uppercase tracking-widest text-white">
            Execution Engine Log
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={refresh}
            data-testid="liquidity-execution-log-refresh"
            className="text-xs"
          >
            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={runNow}
            disabled={busy}
            data-testid="liquidity-execution-log-run"
            className="rounded-lg bg-[hsl(var(--phoenix-orange))] text-black hover:brightness-110 font-display uppercase tracking-widest text-[10px]"
          >
            <Zap className="h-3 w-3 mr-1" /> {busy ? 'Running…' : 'Run Cycle Now'}
          </Button>
        </div>
      </div>
      <ScrollArea className="max-h-[340px] pr-2 scrollbar-thin">
        {loading ? (
          <div className="text-xs text-muted-foreground py-3">Loading executions…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-muted-foreground py-3">
            No executions yet. The engine runs every Sunday at 20:00 UTC, or click “Run Cycle Now”.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => {
              const vis = STATUS_VIS[it.status] || STATUS_VIS.pending;
              const Icon = vis.Icon;
              return (
                <li
                  key={it.id}
                  data-testid="liquidity-execution-row"
                  data-status={it.status}
                  className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-start gap-3"
                >
                  <div className={`h-9 w-9 rounded-xl grid place-items-center bg-black/40 border border-white/10 ${vis.color} shrink-0`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <div className={`font-display uppercase tracking-widest text-xs ${vis.color}`}>
                        {vis.label}
                        {it.dry_run && it.status !== 'dry_run' && (
                          <span className="ml-2 text-[10px] text-[hsl(var(--alerts-magenta))]">(dry-run)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {timeAgo(it.completed_at || it.created_at)}
                      </div>
                    </div>
                    <div className="text-sm text-white/85 mt-1 font-mono tabular-nums">
                      {Number(it.weekly_collected_xrp || 0).toFixed(2)} XRP →{' '}
                      <span className="text-[hsl(var(--phoenix-orange))]">
                        {Number(it.allocated_xema_xrp || 0).toFixed(2)} XEMA
                      </span>{' '}
                      <span className="text-muted-foreground">
                        ({it.allocation_xema_pct}% / {it.allocation_ops_pct}%)
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground font-mono">
                      {it.tx_hash && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {it.tx_hash.slice(0, 16)}…
                        </span>
                      )}
                      {it.dest_amm_address && (
                        <span>→ {shortAddr(it.dest_amm_address)}</span>
                      )}
                      {it.error && <span className="text-[hsl(var(--neon-red))]">{it.error}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </Card>
  );
}
