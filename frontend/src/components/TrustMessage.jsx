import { Card } from '@/components/ui/card';
import { Sparkles, ShieldCheck } from 'lucide-react';

export function TrustMessage({ className = '' }) {
  return (
    <Card
      data-testid="trust-message"
      className={`rounded-2xl glass-card border-white/10 p-4 flex items-start gap-3 ${className}`}
    >
      <div className="shrink-0 h-9 w-9 rounded-xl bg-[hsl(var(--phoenix-orange))]/10 border border-[hsl(var(--phoenix-orange))]/30 grid place-items-center">
        <ShieldCheck className="h-4 w-4 text-[hsl(var(--phoenix-orange))]" />
      </div>
      <div className="flex-1 text-xs sm:text-sm text-white/85 leading-relaxed">
        <span className="text-[hsl(var(--phoenix-orange))] font-semibold">XEMA support pool. </span>
        A portion of platform revenue is allocated toward supporting the XEMA ecosystem,
        including liquidity strengthening and market activity.
      </div>
      <Sparkles className="hidden sm:block h-4 w-4 text-[hsl(var(--electric-blue))] mt-0.5 shrink-0" />
    </Card>
  );
}
