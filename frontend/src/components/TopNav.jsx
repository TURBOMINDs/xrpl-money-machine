import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Flame, Bell, LayoutDashboard, Settings as SettingsIcon, LogOut, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { shortAddr } from '@/lib/format';

export function TopNav() {
  const { user, me, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const path = loc.pathname;

  const link = (to, label, Icon) => (
    <Link
      to={to}
      data-testid={`nav-link-${label.toLowerCase().replace(/\s/g, '-')}`}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
        path === to
          ? 'bg-white/[0.06] text-white'
          : 'text-muted-foreground hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="inline">{label}</span>
    </Link>
  );

  return (
    <header
      className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-white/10"
      data-testid="top-nav"
    >
      <div className="max-w-[1500px] mx-auto flex items-center gap-4 px-4 sm:px-6 lg:px-10 py-3">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2" data-testid="nav-brand">
          <Flame className="h-6 w-6 text-[hsl(var(--phoenix-orange))] flame-bob" />
          <span className="font-display text-base sm:text-lg font-bold tracking-wider shimmer-title">XRPL UMM</span>
        </Link>
        {user && (
          <nav className="flex items-center gap-1">
            {link('/dashboard', 'Dashboard', LayoutDashboard)}
            {link('/alerts', 'Alerts', Bell)}
            {link('/subscribe', 'Subscribe', Crown)}
            {link('/settings', 'Settings', SettingsIcon)}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {me?.subscription && (
                <Badge
                  data-testid="nav-subscription-badge"
                  className={`font-display uppercase ${
                    me.subscription.tier === 'ultimate'
                      ? 'neon-gold'
                      : me.subscription.tier === 'plus'
                        ? 'neon-orange'
                        : 'neon-blue'
                  } text-white bg-transparent border`}
                >
                  {me.subscription.tier} · {me.subscription.status}
                </Badge>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10" data-testid="nav-user-address-container">
                <Flame className="h-3.5 w-3.5 text-[hsl(var(--phoenix-orange))]" />
                <span className="font-mono text-xs text-white/80" data-testid="nav-user-addr">
                  {shortAddr(user.xrpl_address)}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => { await logout(); nav('/'); }}
                data-testid="nav-logout-button"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
