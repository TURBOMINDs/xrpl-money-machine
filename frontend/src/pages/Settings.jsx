import { useEffect, useState } from 'react';
import { TopNav } from '@/components/TopNav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Flame, Bell, Check, Settings as SettingsIcon, Wallet, Send } from 'lucide-react';
import { toast } from 'sonner';
import { notifApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Settings() {
  const { user, me, logout } = useAuth();
  const [osConfig, setOsConfig] = useState(null);
  const [browserEnabled, setBrowserEnabled] = useState(false);

  useEffect(() => {
    notifApi.config().then(({ data }) => setOsConfig(data)).catch(() => {});
    if (typeof Notification !== 'undefined') {
      setBrowserEnabled(Notification.permission === 'granted');
    }
  }, []);

  const enableBrowser = async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setBrowserEnabled(p === 'granted');
    if (p === 'granted') new Notification('XRPL UMM', { body: 'Browser notifications enabled' });
  };

  const sendTest = async () => {
    try {
      const { data } = await notifApi.test('XRPL UMM Test', 'This is a test notification.');
      toast.success(data?.mock ? 'Mock push sent (check server log)' : `Push sent to ${data?.sent} device(s)`);
    } catch (e) {
      toast.error('Failed to send test push');
    }
  };

  return (
    <div className="relative bg-cinematic min-h-screen noise-overlay">
      <TopNav />
      <main className="relative max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-5">
        <h1 className="font-display text-3xl">Settings</h1>

        <Card className="rounded-2xl glass-card p-5" data-testid="settings-account">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-[hsl(var(--electric-blue))]" />
            <div className="font-display uppercase tracking-widest text-sm">Account</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">XRPL Address</span>
              <span className="font-mono text-white/90" data-testid="settings-account-address">{user?.xrpl_address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subscription</span>
              <span className="font-mono uppercase">
                {me?.subscription ? `${me.subscription.tier} · ${me.subscription.status}` : 'none'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slots</span>
              <span className="font-mono">{me?.slots_used} / {me?.slots_limit}</span>
            </div>
          </div>
          <Separator className="my-4 bg-white/10" />
          <Button variant="secondary" onClick={logout} className="rounded-xl bg-white/[0.06] border border-white/10" data-testid="settings-logout">
            Sign out
          </Button>
        </Card>

        <Card className="rounded-2xl glass-card p-5" data-testid="settings-notifications">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-[hsl(var(--alerts-magenta))]" />
            <div className="font-display uppercase tracking-widest text-sm">Notifications</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Button
              onClick={enableBrowser}
              variant="secondary"
              data-testid="settings-enable-browser"
              className="rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] justify-start"
            >
              {browserEnabled ? <Check className="h-4 w-4 mr-2 text-emerald-400" /> : <Bell className="h-4 w-4 mr-2" />}
              {browserEnabled ? 'Browser Enabled' : 'Enable Browser Notifications'}
            </Button>
            <Button
              onClick={sendTest}
              data-testid="settings-test-push"
              className="rounded-xl bg-gradient-to-br from-[hsl(var(--alerts-magenta))] to-[hsl(var(--alerts-violet))] text-white justify-start hover:brightness-110"
            >
              <Send className="h-4 w-4 mr-2" /> Send Test Push
            </Button>
          </div>
          {osConfig && (
            <div className="mt-3 text-[11px] text-muted-foreground font-mono bg-black/30 rounded-lg p-2 border border-white/10">
              onesignal app_id: {osConfig.app_id} · mock: {String(osConfig.mock_mode)}
            </div>
          )}
          <div className="mt-3 text-[11px] text-muted-foreground">
            In mock mode, pushes are logged server-side. Swap in your OneSignal REST API key and app ID to enable real web push delivery.
          </div>
        </Card>

        <Card className="rounded-2xl glass-card p-5" data-testid="settings-integrations">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-[hsl(var(--phoenix-orange))]" />
            <div className="font-display uppercase tracking-widest text-sm">Integrations</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Xaman (XUMM)</span>
              <span className="font-mono text-[hsl(var(--phoenix-orange))]">mock mode</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">OneSignal Web Push</span>
              <span className="font-mono text-[hsl(var(--alerts-magenta))]">{osConfig?.mock_mode ? 'mock mode' : 'live'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">XRPL Node</span>
              <span className="font-mono text-[hsl(var(--electric-blue))]">live (s1.ripple.com)</span>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
