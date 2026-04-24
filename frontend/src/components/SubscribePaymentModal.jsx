import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Flame, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { subsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function SubscribePaymentModal({ open, onOpenChange, tier, intent }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(intent?.status || 'pending');
  const { refresh } = useAuth();

  const copy = async () => {
    if (!intent) return;
    await navigator.clipboard.writeText(intent.qr_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const simulatePayment = async () => {
    if (!intent) return;
    setBusy(true);
    try {
      await subsApi.mockResolvePayment(intent.intent_id);
      const { data } = await subsApi.getIntent(intent.intent_id);
      setStatus(data.status);
      if (data.status === 'signed') {
        toast.success(`Subscription activated: ${tier?.name || tier?.id}`);
        await refresh();
        onOpenChange(false);
      } else {
        toast.error('Payment not verified yet, try again');
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="subscribe-payment-modal" className="sm:max-w-md glass-card border-white/10 neon-orange rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Flame className="h-5 w-5 text-[hsl(var(--phoenix-orange))]" />
            Pay with Xaman
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Scan the QR to send {intent?.xrp_amount ?? '…'} XRP (≈ ${intent?.usd_amount}) to the
            subscription wallet. Backend verifies the transaction before activating your tier.
          </DialogDescription>
        </DialogHeader>
        {intent && (
          <div className="space-y-4">
            <div className="rounded-xl bg-black/40 border border-white/10 p-4 flex items-center gap-3">
              <div className="shrink-0 h-24 w-24 rounded-lg bg-white grid place-items-center" data-testid="subscribe-payment-qr">
                <img
                  alt="Xaman Payment QR"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(intent.qr_url)}`}
                  className="h-full w-full"
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-xs text-muted-foreground">Destination</div>
                <div className="font-mono text-[11px] break-all text-white/80">{intent.dest_address}</div>
                <div className="text-xs text-muted-foreground pt-1">Amount</div>
                <div className="font-display text-lg text-[hsl(var(--phoenix-orange))] tabular-nums">
                  {intent.xrp_amount} XRP
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="secondary" onClick={copy} data-testid="subscribe-payment-copy">
                    {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />} Copy link
                  </Button>
                  <a
                    href={intent.deeplink}
                    className="text-xs text-[hsl(var(--electric-blue))] underline"
                    data-testid="subscribe-payment-deeplink"
                  >
                    Open Xaman
                  </a>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-[hsl(var(--phoenix-orange))]/30 bg-[hsl(var(--phoenix-orange))]/5 p-3 text-xs text-white/80">
              <span className="font-semibold text-[hsl(var(--phoenix-orange))]">Mock mode:</span> click
              <span className="mx-1 font-semibold">Simulate Payment</span> to auto-verify and activate {tier?.name}.
            </div>
            <Button
              onClick={simulatePayment}
              disabled={busy}
              className="w-full rounded-xl bg-[hsl(var(--phoenix-orange))] text-black font-display uppercase tracking-widest hover:brightness-110"
              data-testid="subscribe-payment-simulate"
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Flame className="h-4 w-4 mr-2" />}
              {busy ? 'Verifying…' : 'Simulate Payment'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
