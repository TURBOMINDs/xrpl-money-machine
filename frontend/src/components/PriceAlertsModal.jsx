import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Plus, Trash2, Settings, Check } from 'lucide-react';
import { toast } from 'sonner';
import { alertsApi, notifApi } from '@/lib/api';
import { timeAgo } from '@/lib/format';

const TYPES = [
  { id: 'price_above', label: 'Price goes above' },
  { id: 'price_below', label: 'Price goes below' },
  { id: 'pct_change', label: '% change exceeds' },
];

export function PriceAlertsModal({ pairId, triggerAsChild, children }) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [type, setType] = useState('price_above');
  const [threshold, setThreshold] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [onesignalInfo, setOnesignalInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const [{ data: aa }, { data: ee }] = await Promise.all([
        alertsApi.list(),
        alertsApi.events({ limit: 20 }),
      ]);
      setAlerts((aa || []).filter((a) => ['price_above', 'price_below', 'pct_change'].includes(a.type)));
      setEvents((ee || []).filter((e) => ['price_above', 'price_below', 'pct_change'].includes(e.type)));
    } catch (e) {
      setAlerts([]);
      setEvents([]);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setBrowserEnabled(Notification.permission === 'granted');
    }
  }, []);

  const add = async () => {
    const val = parseFloat(threshold);
    if (type !== 'pct_change' && (!val || val <= 0)) {
      toast.error('Threshold must be > 0');
      return;
    }
    if (type === 'pct_change' && (!val || val <= 0 || val > 1000)) {
      toast.error('Enter % between 0–100');
      return;
    }
    setBusy(true);
    try {
      await alertsApi.create({ amm_pair_id: pairId || null, type, threshold: val, currency });
      toast.success('Alert added');
      setThreshold('');
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to add alert');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    await alertsApi.remove(id);
    await refresh();
  };

  const enableBrowser = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('Your browser does not support notifications.');
      return;
    }
    const perm = await Notification.requestPermission();
    setBrowserEnabled(perm === 'granted');
    if (perm === 'granted') {
      new Notification('XRPL UMM', { body: 'Browser notifications enabled for price alerts.' });
      toast.success('Browser notifications enabled');
    } else {
      toast.error('Notifications permission denied');
    }
  };

  const showOnesignalInfo = async () => {
    try {
      const { data } = await notifApi.config();
      setOnesignalInfo(data);
      try {
        await notifApi.test('XRPL UMM', 'Test push from Price Alerts');
      } catch {}
      toast.info(data?.mock_mode ? 'OneSignal in MOCK mode — push logged on server' : 'Test push sent');
    } catch {
      toast.error('Failed to fetch OneSignal config');
    }
  };

  const Trigger = children || (
    <Button
      className="rounded-xl bg-gradient-to-br from-[hsl(var(--alerts-magenta))] to-[hsl(var(--alerts-violet))] text-white font-semibold hover:brightness-110"
      data-testid="price-alerts-open-modal"
    >
      <Bell className="h-4 w-4 mr-2" /> Price Alerts
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild={triggerAsChild || !children}>{Trigger}</DialogTrigger>
      <DialogContent
        data-testid="price-alerts-modal"
        className="sm:max-w-lg border-white/10 neon-magenta rounded-2xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(233,30,99,0.14), rgba(147,51,234,0.12)), rgba(12,10,18,0.95)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[hsl(var(--alerts-magenta))] flex items-center gap-2">
            <Bell className="h-6 w-6" /> Price Alerts
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Get browser & push notifications when XRP/pair price crosses your threshold.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Alert Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger
                data-testid="price-alerts-alert-type-select"
                className="bg-black/30 border-white/10 rounded-xl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1020] border-white/10">
                {TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              data-testid="price-alerts-threshold-input"
              placeholder={type === 'pct_change' ? 'e.g. 5' : 'e.g. 0.00003'}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              type="number"
              step="any"
              className="bg-black/30 border-white/10 rounded-xl font-mono"
            />
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger
                data-testid="price-alerts-currency-select"
                className="bg-black/30 border-white/10 rounded-xl min-w-[90px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1020] border-white/10">
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="XRP">XRP</SelectItem>
                <SelectItem value="PCT">%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={add}
            disabled={busy}
            data-testid="price-alerts-add-alert-button"
            className="w-full rounded-xl text-white font-semibold bg-gradient-to-br from-[hsl(var(--alerts-magenta))] to-[hsl(var(--alerts-violet))] hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Alert
          </Button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              onClick={enableBrowser}
              data-testid="price-alerts-enable-browser-notifications-button"
              variant="secondary"
              className="bg-white/[0.04] border border-white/10 text-white hover:bg-white/[0.08] rounded-xl"
            >
              {browserEnabled ? <Check className="h-4 w-4 mr-1 text-emerald-400" /> : <Bell className="h-4 w-4 mr-1" />}
              {browserEnabled ? 'Browser Enabled' : 'Enable Browser Notifications'}
            </Button>
            <Button
              onClick={showOnesignalInfo}
              data-testid="price-alerts-onesignal-info-button"
              variant="secondary"
              className="bg-white/[0.04] border border-white/10 text-white hover:bg-white/[0.08] rounded-xl"
            >
              <Settings className="h-4 w-4 mr-1" /> OneSignal Info
            </Button>
          </div>
          {onesignalInfo && (
            <div className="text-[11px] text-muted-foreground font-mono bg-black/30 rounded-lg p-2 border border-white/10">
              app_id: {onesignalInfo.app_id} · mock_mode: {String(onesignalInfo.mock_mode)}
            </div>
          )}

          <Separator className="bg-white/10" />

          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Active Alerts</div>
            <ScrollArea className="max-h-36 scrollbar-thin pr-2" data-testid="price-alerts-active-alerts-list">
              {alerts.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">No active alerts. Add one above.</div>
              ) : (
                <ul className="space-y-1">
                  {alerts.map((a) => (
                    <li
                      key={a.id}
                      data-testid="price-alerts-active-item"
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
                    >
                      <span className="font-mono">
                        {a.type.replace('_', ' ')} ·{' '}
                        <span className="text-white">
                          {a.threshold}
                          {a.currency === 'PCT' ? '%' : ''} {a.currency}
                        </span>
                      </span>
                      <button
                        onClick={() => remove(a.id)}
                        className="text-muted-foreground hover:text-[hsl(var(--alerts-magenta))]"
                        data-testid="price-alerts-remove-item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Alert Log</div>
            <ScrollArea className="max-h-32 scrollbar-thin pr-2" data-testid="price-alerts-alert-log">
              {events.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">No alerts triggered yet.</div>
              ) : (
                <ul className="space-y-1">
                  {events.map((e) => (
                    <li key={e.id} className="text-[11px] text-white/75 flex justify-between rounded-lg bg-black/20 px-2 py-1.5 border border-white/10">
                      <span className="truncate">{e.title}: {e.message}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{timeAgo(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
