import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/TopNav';
import { Footer } from '@/components/Footer';
import { CandlestickChart } from '@/components/CandlestickChart';
import { PriceAlertsModal } from '@/components/PriceAlertsModal';
import { LiveAlertsPanel } from '@/components/LiveAlertsPanel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { ammApi } from '@/lib/api';
import { formatXRP, formatUSD, shortAddr } from '@/lib/format';

export default function PairDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [pair, setPair] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await ammApi.list();
        const found = (data || []).find((p) => p.id === id);
        setPair(found || null);
        const { data: s } = await ammApi.stats(id);
        setStats(s);
      } catch (e) {}
    })();
  }, [id]);

  return (
    <div className="relative bg-cinematic min-h-screen noise-overlay">
      <TopNav />
      <main className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => nav('/dashboard')} data-testid="pair-detail-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </Button>
        {!pair ? (
          <div className="text-muted-foreground">Pair not found.</div>
        ) : (
          <>
            <Card className="rounded-2xl glass-card p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[hsl(var(--electric-blue))]" />
                  <div>
                    <div className="font-display uppercase tracking-widest text-sm">{pair.pair_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{shortAddr(pair.lp_address)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-white/[0.04] border border-white/10 font-mono text-xs">{pair.status}</Badge>
                  <PriceAlertsModal pairId={pair.id} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Price (USD)" value={formatUSD(stats?.price_usd)} />
                <Stat label="Price (XRP)" value={stats?.price_xrp ? stats.price_xrp.toFixed(6) : '—'} />
                <Stat label="Reserve XRP" value={formatXRP(pair.reserve_asset1)} />
                <Stat label="Reserve Token" value={formatXRP(pair.reserve_asset2)} />
                <Stat label="Fee (bps)" value={pair.trading_fee_bps ?? '—'} />
              </div>
            </Card>

            <div className="grid lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8">
                <CandlestickChart pairId={pair.id} />
              </div>
              <div className="lg:col-span-4 min-h-[400px]">
                <LiveAlertsPanel authed title="Pair Alerts" />
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-base text-white tabular-nums">{value}</div>
    </div>
  );
}
