import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Crown, Flame, Sparkles } from 'lucide-react';
import { formatUSD } from '@/lib/format';

const themes = {
  basic: {
    border: 'neon-blue',
    accent: 'text-[hsl(var(--electric-blue))]',
    icon: Sparkles,
    ctaLabel: 'Subscribe',
    ctaClass:
      'bg-white/[0.06] border border-[hsl(var(--electric-blue))]/40 text-white hover:bg-white/[0.09]',
    glow: 'from-[hsl(var(--electric-blue))]/5 to-transparent',
  },
  plus: {
    border: 'neon-orange',
    accent: 'text-[hsl(var(--phoenix-orange))]',
    icon: Flame,
    ctaLabel: 'Upgrade',
    ctaClass:
      'bg-[hsl(var(--phoenix-orange))] text-black hover:brightness-110 active:scale-[0.98]',
    glow: 'from-[hsl(var(--phoenix-orange))]/10 to-transparent',
  },
  ultimate: {
    border: 'neon-gold',
    accent: 'text-[hsl(var(--ultimate-gold))]',
    icon: Crown,
    ctaLabel: 'Go Pro',
    ctaClass:
      'bg-[hsl(var(--ultimate-gold))] text-black hover:brightness-110 active:scale-[0.98]',
    glow: 'from-[hsl(var(--ultimate-gold))]/10 to-transparent',
  },
};

export function TierCard({ tier, onSelect, current, loading }) {
  const t = themes[tier.id] || themes.basic;
  const Icon = t.icon;
  return (
    <Card
      data-testid="tier-card"
      data-tier={tier.id}
      className={`relative rounded-2xl glass-card ${t.border} p-5 transition-[transform,box-shadow] hover:-translate-y-[2px] flex flex-col`}
    >
      <div className={`absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br ${t.glow}`} />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 rounded-xl bg-white/[0.04] border border-white/10 grid place-items-center ${t.accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="font-display text-sm uppercase tracking-widest">{tier.name}</div>
        </div>
        {tier.badge && (
          <Badge
            data-testid="tier-card-trial-badge"
            className={`uppercase font-display text-[10px] tracking-widest px-2.5 py-0.5 bg-[hsl(var(--neon-red))]/15 text-[hsl(var(--neon-red))] border border-[hsl(var(--neon-red))]/40`}
          >
            {tier.badge}
          </Badge>
        )}
      </div>

      <div className="relative mt-6">
        <div className={`font-display text-4xl font-bold tabular-nums ${t.accent}`}>
          {formatUSD(tier.usd_price)}
          <span className="text-sm text-muted-foreground font-sans"> / month</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 font-mono">
          ≈ {tier.xrp_price} XRP / mo · paid via Xaman
        </div>
      </div>

      <ul className="relative mt-6 space-y-2">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-white/85">
            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${t.accent}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="relative mt-6">
        <Button
          data-testid="tier-card-cta-button"
          data-tier={tier.id}
          onClick={onSelect}
          disabled={loading}
          className={`w-full rounded-xl font-display uppercase tracking-widest ${t.ctaClass}`}
        >
          {current ? 'Current plan' : t.ctaLabel}
        </Button>
        <div className="text-[11px] text-muted-foreground mt-2 text-center">
          {tier.amm_slots} AMM slots · {tier.swaps_per_24h} swaps / 24h
        </div>
      </div>
    </Card>
  );
}
