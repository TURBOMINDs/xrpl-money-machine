import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Flame, Plus, Eraser, Play, Bell, Info } from 'lucide-react';
import { toast } from 'sonner';
import { ammApi } from '@/lib/api';
import { DEMO_AMM_LPS } from '@/lib/format';

export function PairInputForm({ onCreated, onOpenAlert, slotsUsed = 0, slotsLimit = 1 }) {
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = address.trim();
    if (!/^r[A-Za-z0-9]{24,}$/.test(v)) {
      toast.error('Enter a valid XRPL AMM/LP address (starts with r…)');
      return;
    }
    setBusy(true);
    try {
      const { data } = await ammApi.create(v);
      toast.success(`Tracking ${data.pair_name || v.slice(0, 10)}…`);
      setAddress('');
      onCreated?.(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to create pair');
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => setAddress(DEMO_AMM_LPS[0]);

  return (
    <Card className="rounded-2xl glass-card neon-orange p-5" data-testid="pair-input-form">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="h-4 w-4 text-[hsl(var(--phoenix-orange))]" />
        <div className="font-display uppercase tracking-widest text-sm text-white">
          XEMA · Universal Money Machine
        </div>
      </div>
      <div className="text-xs text-muted-foreground mb-3">Enter any XRPL AMM / LP address to start tracking.</div>
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Input
            data-testid="pair-form-amm-address-input"
            placeholder="rXRPLAMMaddress…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="font-mono text-xs bg-black/40 border-white/10 h-11 focus-visible:ring-2 focus-visible:ring-[hsl(var(--electric-blue))]"
          />
          <button
            type="button"
            onClick={useDemo}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[hsl(var(--electric-blue))] underline"
            data-testid="pair-form-use-demo"
          >
            Use demo address
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={submit}
            disabled={busy}
            data-testid="pair-form-create-pair-button"
            className="bg-[hsl(var(--phoenix-orange))] text-black hover:brightness-110 active:scale-[0.98] rounded-xl font-display uppercase tracking-wider"
          >
            <Plus className="h-4 w-4 mr-1" /> Create Pair
          </Button>
          <Button
            onClick={() => setAddress('')}
            variant="secondary"
            data-testid="pair-form-clear-button"
            className="rounded-xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/10"
          >
            <Eraser className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground flex items-center gap-2" data-testid="pair-form-slots-info">
          <Info className="h-3.5 w-3.5" />
          Active Slots:{' '}
          <span className="font-mono font-semibold text-white">
            {slotsUsed} / {slotsLimit}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onOpenAlert}
            data-testid="pair-form-create-alert-button"
            variant="secondary"
            className="rounded-xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/10 font-display uppercase tracking-wider text-xs"
          >
            <Bell className="h-3.5 w-3.5 mr-1" /> Create Alert
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            data-testid="pair-form-start-tracking-button"
            className="rounded-xl bg-transparent border border-[hsl(var(--phoenix-orange))]/60 text-[hsl(var(--phoenix-orange))] hover:bg-[hsl(var(--phoenix-orange))]/10 font-display uppercase tracking-wider text-xs"
          >
            <Play className="h-3.5 w-3.5 mr-1" /> Start Tracking
          </Button>
        </div>
      </div>
    </Card>
  );
}
