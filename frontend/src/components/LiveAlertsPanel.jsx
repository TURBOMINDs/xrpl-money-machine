import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Flame, Shield, Gem, TrendingDown, TrendingUp, Activity, Bell } from 'lucide-react';
import { alertsApi } from '@/lib/api';
import { timeAgo } from '@/lib/format';

const typeVisual = {
  humpback_buy: { Icon: Shield, color: 'text-[hsl(var(--phoenix-orange))]', chip: 'neon-orange' },
  shark_buy: { Icon: TrendingUp, color: 'text-[hsl(var(--phoenix-orange))]', chip: 'neon-orange' },
  liquidity_surge: { Icon: Gem, color: 'text-emerald-400', chip: 'border-emerald-400/30 shadow-[0_0_0_1px_rgba(52,211,153,0.3),0_0_20px_rgba(52,211,153,0.18)]' },
  shark_sell: { Icon: TrendingDown, color: 'text-[hsl(var(--neon-red))]', chip: 'neon-red' },
  price_above: { Icon: TrendingUp, color: 'text-[hsl(var(--electric-blue))]', chip: 'neon-blue' },
  price_below: { Icon: TrendingDown, color: 'text-[hsl(var(--neon-red))]', chip: 'neon-red' },
  pct_change: { Icon: Activity, color: 'text-[hsl(var(--ultimate-gold))]', chip: 'neon-gold' },
};

export function LiveAlertsPanel({ title = 'Live Alerts', limit = 12, authed = false, className = '', onViewAll }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchEvents = async () => {
      try {
        const { data } = await alertsApi.events({ limit });
        if (mounted) setEvents(data || []);
      } catch (e) {
        // silent
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchEvents();
    const id = setInterval(fetchEvents, 8000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [limit, authed]);

  return (
    <Card
      data-testid="live-alerts-panel"
      className={`rounded-2xl glass-card neon-orange p-4 flex flex-col h-full ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-[hsl(var(--phoenix-orange))] flame-bob" />
          <div className="font-display text-sm uppercase tracking-widest text-white">
            {title}
          </div>
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--neon-red))] pulse-glow ml-2" aria-label="live" />
        </div>
        <Badge className="bg-white/[0.04] border border-white/10 text-[10px] uppercase tracking-widest">
          Real-time
        </Badge>
      </div>

      <ScrollArea className="flex-1 mt-3 pr-2 scrollbar-thin">
        {loading ? (
          <div className="text-xs text-muted-foreground py-4">Loading alerts…</div>
        ) : events.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4">No alerts yet.</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => {
              const vis = typeVisual[e.type] || typeVisual.pct_change;
              const Icon = vis.Icon;
              return (
                <li
                  key={e.id}
                  data-testid="live-alerts-item"
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-start gap-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className={`h-9 w-9 rounded-xl grid place-items-center bg-black/40 border ${vis.chip} shrink-0`}>
                    <Icon className={`h-4 w-4 ${vis.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className={`text-sm font-semibold font-display uppercase tracking-wider ${vis.color}`}>
                        {e.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono shrink-0" data-testid="live-alerts-item-timestamp">
                        {timeAgo(e.created_at)}
                      </div>
                    </div>
                    <div className="text-xs text-white/75 mt-0.5">{e.message}</div>
                    {e.tx_hash && (
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono truncate">tx: {e.tx_hash.slice(0, 18)}…</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      {onViewAll && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <Button
            onClick={onViewAll}
            variant="ghost"
            className="w-full text-xs text-[hsl(var(--phoenix-orange))] hover:text-[hsl(var(--phoenix-orange))] hover:bg-white/[0.04]"
            data-testid="live-alerts-view-all"
          >
            <Bell className="h-3.5 w-3.5 mr-1" /> View all alerts →
          </Button>
        </div>
      )}
    </Card>
  );
}
