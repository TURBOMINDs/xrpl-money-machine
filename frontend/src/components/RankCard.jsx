import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ranksApi } from '@/lib/api';
import { Fish, Crown, CircleDot, Activity, TrendingUp } from 'lucide-react';

const RANK_META = {
  shrimp: { label: 'Shrimp', range: '1-499 XRP', color: 'text-rose-400', border: 'border-rose-400/20' },
  crab: { label: 'Crab', range: '500-1,999 XRP', color: 'text-amber-400', border: 'border-amber-400/20' },
  octopus: { label: 'Octopus', range: '2,000-4,999 XRP', color: 'text-fuchsia-400', border: 'border-fuchsia-400/20' },
  dolphin: { label: 'Dolphin', range: '5,000-6,999 XRP', color: 'text-sky-400', border: 'border-sky-400/20' },
  orca: { label: 'Orca', range: '7,000-24,999 XRP', color: 'text-blue-400', border: 'border-blue-400/20' },
  shark: { label: 'Shark', range: '25,000-49,999 XRP', color: 'text-cyan-300', border: 'border-cyan-300/20' },
  whale: { label: 'Whale', range: '50,000-99,999 XRP', color: 'text-indigo-300', border: 'border-indigo-300/20' },
  humpback: { label: 'Humpback', range: '100,000+ XRP', color: 'text-[hsl(var(--phoenix-orange))]', border: 'border-[hsl(var(--phoenix-orange))]/25' },
};

function RankIcon({ rank }) {
  // Simple differentiation via emoji-free glyphs + lucide
  if (rank === 'humpback' || rank === 'whale') return <Fish className="h-5 w-5" />;
  if (rank === 'shark' || rank === 'orca') return <TrendingUp className="h-5 w-5" />;
  if (rank === 'dolphin') return <Activity className="h-5 w-5" />;
  if (rank === 'octopus') return <CircleDot className="h-5 w-5" />;
  if (rank === 'crab') return <Crown className="h-5 w-5" />;
  return <Fish className="h-5 w-5" />;
}

export function RankCard({ rank, config, onToggle, compact = false }) {
  const meta = RANK_META[rank] || RANK_META.shrimp;
  return (
    <Card
      data-testid="rank-card"
      data-rank={rank}
      className={`rounded-2xl glass-card p-4 hover:-translate-y-[1px] transition-transform ${meta.border} border`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-2xl bg-white/[0.04] border border-white/10 grid place-items-center ${meta.color}`}>
          <RankIcon rank={rank} />
        </div>
        <div>
          <div className={`font-display uppercase text-xs tracking-widest ${meta.color}`}>{meta.label}</div>
          <div className="text-[11px] text-muted-foreground font-mono tabular-nums">{meta.range}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex items-center justify-between rounded-xl bg-black/30 border border-white/10 px-2 py-1.5">
          <span className="text-[11px] text-muted-foreground">Price</span>
          <Switch
            data-testid="rank-card-price-alert-toggle"
            data-rank={rank}
            checked={!!config?.price_alerts}
            onCheckedChange={(v) => onToggle(rank, { price_alerts: v, activity_alerts: !!config?.activity_alerts })}
          />
        </label>
        <label className="flex items-center justify-between rounded-xl bg-black/30 border border-white/10 px-2 py-1.5">
          <span className="text-[11px] text-muted-foreground">Activity</span>
          <Switch
            data-testid="rank-card-activity-alert-toggle"
            data-rank={rank}
            checked={config?.activity_alerts !== false}
            onCheckedChange={(v) => onToggle(rank, { price_alerts: !!config?.price_alerts, activity_alerts: v })}
          />
        </label>
      </div>
    </Card>
  );
}

export function RanksGrid({ compact = false }) {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const ORDER = compact
    ? ['shrimp', 'crab', 'octopus', 'shark', 'humpback']
    : ['shrimp', 'crab', 'octopus', 'dolphin', 'orca', 'shark', 'whale', 'humpback'];

  useEffect(() => {
    ranksApi.config()
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((c) => { map[c.rank] = c; });
        setConfigs(map);
      })
      .catch(() => setConfigs({}))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (rank, values) => {
    setConfigs((p) => ({ ...p, [rank]: { ...(p[rank] || {}), ...values, rank } }));
    try {
      await ranksApi.upsert({ rank, ...values });
    } catch (e) {
      // revert on error
    }
  };

  return (
    <div
      data-testid="ranks-grid"
      className={`grid gap-3 ${compact ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8'}`}
    >
      {ORDER.map((r) => (
        <RankCard key={r} rank={r} config={configs[r]} onToggle={toggle} compact={compact} />
      ))}
    </div>
  );
}
