import { useState } from 'react';
import { Bell, BellOff, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOneSignal } from '@/lib/useOneSignal';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

/**
 * NotificationIndicator — compact UI showing OneSignal subscription status.
 *
 * - When opted-in: green "Notifications Enabled" badge
 * - When opted-out / no permission: pink "Enable Alerts" button
 */
export function NotificationIndicator({ compact = false }) {
  const { user } = useAuth();
  const { ready, optedIn, subscriptionId, permission, requestPermission } = useOneSignal({ user });
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const ok = await requestPermission();
      if (ok) {
        toast.success('Notifications enabled — you\u2019ll get whale, liquidity & price alerts.');
      } else {
        toast.error('Notifications permission denied. Enable in your browser settings.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <Badge
        data-testid="notification-indicator"
        data-state="loading"
        className="bg-white/[0.04] border border-white/10 text-muted-foreground font-display uppercase tracking-widest text-[10px]"
      >
        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Push loading
      </Badge>
    );
  }

  if (optedIn && permission === 'granted') {
    return (
      <Badge
        data-testid="notification-indicator"
        data-state="enabled"
        title={subscriptionId ? `Subscribed · ${String(subscriptionId).slice(0, 10)}…` : 'Subscribed'}
        className="bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-display uppercase tracking-widest text-[10px]"
      >
        <CheckCircle2 className="h-3 w-3 mr-1" /> Notifications Enabled
      </Badge>
    );
  }

  if (compact) {
    return (
      <Button
        size="sm"
        onClick={onClick}
        disabled={busy}
        data-testid="notification-indicator-enable-button"
        className="rounded-xl bg-gradient-to-br from-[hsl(var(--alerts-magenta))] to-[hsl(var(--alerts-violet))] text-white font-display uppercase tracking-widest text-[10px] hover:brightness-110"
      >
        {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bell className="h-3 w-3 mr-1" />}
        Enable Alerts
      </Button>
    );
  }

  return (
    <div
      data-testid="notification-indicator"
      data-state="disabled"
      className="flex items-center gap-2"
    >
      <Badge className="bg-white/[0.04] border border-white/10 text-muted-foreground font-display uppercase tracking-widest text-[10px]">
        <BellOff className="h-3 w-3 mr-1" /> Notifications Disabled
      </Badge>
      <Button
        size="sm"
        onClick={onClick}
        disabled={busy}
        data-testid="notification-indicator-enable-button"
        className="rounded-xl bg-gradient-to-br from-[hsl(var(--alerts-magenta))] to-[hsl(var(--alerts-violet))] text-white font-display uppercase tracking-widest text-[10px] hover:brightness-110"
      >
        {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bell className="h-3 w-3 mr-1" />}
        Enable Alerts
      </Button>
    </div>
  );
}
