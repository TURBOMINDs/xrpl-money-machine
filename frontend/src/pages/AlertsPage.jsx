import { useEffect, useState } from 'react';
import { TopNav } from '@/components/TopNav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Trash2, Power, PowerOff, Shield, Gem, TrendingDown, TrendingUp, Activity, Fish } from 'lucide-react';
import { alertsApi } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { PriceAlertsModal } from '@/components/PriceAlertsModal';

const typeIcon = {
  humpback_buy: { Icon: Fish, color: 'text-[hsl(var(--phoenix-orange))]' },
  shark_buy: { Icon: TrendingUp, color: 'text-[hsl(var(--phoenix-orange))]' },
  shark_sell: { Icon: TrendingDown, color: 'text-[hsl(var(--neon-red))]' },
  liquidity_surge: { Icon: Gem, color: 'text-emerald-400' },
  price_above: { Icon: TrendingUp, color: 'text-[hsl(var(--electric-blue))]' },
  price_below: { Icon: TrendingDown, color: 'text-[hsl(var(--neon-red))]' },
  pct_change: { Icon: Activity, color: 'text-[hsl(var(--ultimate-gold))]' },
  whale_buy: { Icon: Shield, color: 'text-[hsl(var(--phoenix-orange))]' },
  whale_sell: { Icon: TrendingDown, color: 'text-[hsl(var(--neon-red))]' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('events');

  const load = async () => {
    const [{ data: a }, { data: e }] = await Promise.all([
      alertsApi.list(),
      alertsApi.events({ limit: 50 }),
    ]);
    setAlerts(a || []);
    setEvents(e || []);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative bg-cinematic min-h-screen noise-overlay">
      <TopNav />
      <main className="relative max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Notifications</div>
            <h1 className="font-display text-2xl sm:text-3xl">Alerts</h1>
          </div>
          <PriceAlertsModal />
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 w-fit" data-testid="alerts-tabs">
          <button
            data-testid="alerts-tab-events"
            onClick={() => setTab('events')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display uppercase tracking-widest ${tab === 'events' ? 'bg-[hsl(var(--phoenix-orange))]/20 text-[hsl(var(--phoenix-orange))]' : 'text-muted-foreground'}`}
          >
            Live Feed
          </button>
          <button
            data-testid="alerts-tab-rules"
            onClick={() => setTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display uppercase tracking-widest ${tab === 'rules' ? 'bg-[hsl(var(--phoenix-orange))]/20 text-[hsl(var(--phoenix-orange))]' : 'text-muted-foreground'}`}
          >
            Rules ({alerts.length})
          </button>
        </div>

        {tab === 'events' ? (
          <Card className="rounded-2xl glass-card p-4" data-testid="alerts-events-card">
            {events.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No events yet.</div>
            ) : (
              <ul className="divide-y divide-white/5">
                {events.map((e) => {
                  const vis = typeIcon[e.type] || typeIcon.pct_change;
                  const Icon = vis.Icon;
                  return (
                    <li key={e.id} className="flex items-start gap-3 py-3" data-testid="alerts-event-row">
                      <div className="h-9 w-9 rounded-xl grid place-items-center border border-white/10 bg-black/40">
                        <Icon className={`h-4 w-4 ${vis.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className={`font-display uppercase tracking-widest text-xs ${vis.color}`}>{e.title}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{timeAgo(e.created_at)}</div>
                        </div>
                        <div className="text-sm text-white/85 mt-0.5">{e.message}</div>
                        {e.tx_hash && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-1 truncate">tx: {e.tx_hash}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ) : (
          <Card className="rounded-2xl glass-card p-4" data-testid="alerts-rules-card">
            {alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No alert rules yet. Open the Price Alerts modal to create one.
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3" data-testid="alerts-rule-row">
                    <Bell className="h-4 w-4 text-[hsl(var(--alerts-magenta))]" />
                    <div className="flex-1">
                      <div className="font-mono text-xs text-white/90">
                        {a.type.replace('_', ' ')} · {a.threshold ?? '—'} {a.currency}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Triggered {a.triggered_count}×</div>
                    </div>
                    <Badge className={`text-[10px] ${a.is_active ? 'text-emerald-300 border-emerald-300/30' : 'text-muted-foreground border-white/10'} bg-transparent border`}>
                      {a.is_active ? 'active' : 'paused'}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={async () => { await alertsApi.toggle(a.id); load(); }} data-testid="alerts-rule-toggle">
                      {a.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => { await alertsApi.remove(a.id); load(); }} data-testid="alerts-rule-remove">
                      <Trash2 className="h-4 w-4 text-[hsl(var(--neon-red))]" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
