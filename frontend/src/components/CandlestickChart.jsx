import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3 } from 'lucide-react';
import {
  ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ammApi } from '@/lib/api';
import { formatUSD } from '@/lib/format';

const RANGES = [
  { id: '1D', interval: '15m', range: '1d' },
  { id: '7D', interval: '1h', range: '7d' },
  { id: '30D', interval: '4h', range: '30d' },
  { id: '90D', interval: '1d', range: '90d' },
  { id: '1Y', interval: '1d', range: '1y' },
];

function CandleBar({ x, y, width, height, open, close, high, low, payload }) {
  // Recharts passes the bar geometry; we render custom candle
  const isUp = (payload?.c ?? close) >= (payload?.o ?? open);
  const color = isUp ? 'hsl(145 85% 45%)' : 'hsl(350 100% 55%)';
  const cx = x + width / 2;
  return (
    <g>
      <line x1={cx} x2={cx} y1={payload?.__hY ?? y} y2={payload?.__lY ?? y + height} stroke={color} strokeWidth={1.2} />
      <rect
        x={x + width * 0.18}
        y={Math.min(payload?.__oY ?? y, payload?.__cY ?? y)}
        width={width * 0.64}
        height={Math.max(1, Math.abs((payload?.__oY ?? y) - (payload?.__cY ?? y)))}
        fill={color}
        opacity={0.95}
        rx={1.5}
      />
    </g>
  );
}

export function CandlestickChart({ pairId }) {
  const [active, setActive] = useState('30D');
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = RANGES.find((x) => x.id === active) || RANGES[2];
    setLoading(true);
    ammApi.chart(pairId, r.interval, r.range)
      .then(({ data }) => setPoints((data?.points || []).slice(-80)))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [pairId, active]);

  const prepared = useMemo(() => {
    if (!points.length) return [];
    const min = Math.min(...points.map((p) => p.l));
    const max = Math.max(...points.map((p) => p.h));
    const pad = (max - min) * 0.04 || 1e-6;
    return points.map((p) => ({
      ...p,
      date: new Date(p.t).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit' }),
      __range: max - min + pad,
      __min: min - pad,
      range: p.h - p.l,
      low: p.l,
    }));
  }, [points]);

  return (
    <Card className="rounded-2xl glass-card p-4 flex flex-col gap-3" data-testid="candlestick-chart">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[hsl(var(--electric-blue))]" />
          <div className="font-display text-sm uppercase tracking-widest text-white">Price Chart</div>
        </div>
        <Tabs value={active} onValueChange={setActive} data-testid="chart-timeframe-tabs">
          <TabsList className="bg-white/[0.04] border border-white/10 rounded-xl p-1 h-8">
            {RANGES.map((r) => (
              <TabsTrigger
                key={r.id}
                value={r.id}
                data-testid="chart-timeframe-tab"
                className="text-[11px] px-2.5 h-6 rounded-lg data-[state=active]:bg-[hsl(var(--phoenix-orange))]/20 data-[state=active]:text-[hsl(var(--phoenix-orange))]"
              >
                {r.id}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="w-full h-[280px] sm:h-[320px]" style={{ minHeight: 280, minWidth: 200 }}>
        {loading ? (
          <div className="h-full grid place-items-center text-muted-foreground text-sm">Loading chart…</div>
        ) : prepared.length === 0 ? (
          <div className="h-full grid place-items-center text-muted-foreground text-sm">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={220}>
            <ComposedChart data={prepared} margin={{ top: 6, right: 12, bottom: 0, left: 12 }}>
              <defs>
                <linearGradient id="volFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(24 100% 55%)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(24 100% 55%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(240 6% 18%)" strokeOpacity={0.55} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                minTickGap={30}
              />
              <YAxis
                yAxisId="price"
                orientation="right"
                domain={['dataMin', 'dataMax']}
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                width={70}
                tickFormatter={(v) => formatUSD(v)}
              />
              <YAxis
                yAxisId="vol"
                orientation="left"
                hide
                domain={[0, 'dataMax']}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(0,0,0,0.85)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: 'white',
                  fontSize: 12,
                }}
                formatter={(v, name) => [typeof v === 'number' ? formatUSD(v) : v, name.toUpperCase()]}
              />
              {/* Volume bars */}
              <Bar yAxisId="vol" dataKey="v" fill="url(#volFill)" radius={[2, 2, 0, 0]} maxBarSize={14} />
              {/* Candle body via Bar with low+range */}
              <Bar yAxisId="price" dataKey="low" stackId="wick" fill="transparent" isAnimationActive={false} />
              <Bar yAxisId="price" dataKey="range" stackId="wick" isAnimationActive={false}>
                {prepared.map((p, i) => (
                  <Cell key={i} fill={p.c >= p.o ? 'hsl(145 85% 45%)' : 'hsl(350 100% 55%)'} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground font-mono">
        * Chart uses deterministic demo data seeded from live pool state (historical OHLCV not exposed by public XRPL node).
      </div>
    </Card>
  );
}
