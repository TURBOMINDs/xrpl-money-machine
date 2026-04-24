import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Flame, Wallet, Copy, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { DEMO_ADDRESSES } from '@/lib/format';

export function XamanLoginButton({ triggerProps = {}, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addr, setAddr] = useState(DEMO_ADDRESSES[0]);
  const [copied, setCopied] = useState(false);
  const { setToken, refresh } = useAuth();
  const nav = useNavigate();

  const begin = async () => {
    setBusy(true);
    try {
      const { data } = await authApi.signin();
      setPayload(data);
    } catch (e) {
      toast.error('Failed to create Xaman sign-in payload');
    } finally {
      setBusy(false);
    }
  };

  const resolveMock = async () => {
    if (!payload) return;
    if (!/^r[A-Za-z0-9]{24,}$/.test(addr.trim())) {
      toast.error('Enter a valid XRPL address starting with r…');
      return;
    }
    setBusy(true);
    try {
      const { data } = await authApi.mockResolve(payload.payload_uuid, addr.trim());
      if (data?.token) {
        setToken(data.token);
      }
      await refresh();
      toast.success(`Signed in as ${addr.trim().slice(0, 8)}…`);
      setOpen(false);
      setPayload(null);
      if (onSuccess) onSuccess();
      else nav('/dashboard');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (payload?.qr_url) {
      await navigator.clipboard.writeText(payload.qr_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPayload(null); }}>
      <DialogTrigger asChild>
        <Button
          onClick={begin}
          data-testid="xaman-login-button"
          className="rounded-xl bg-[hsl(var(--phoenix-orange))] hover:brightness-110 active:scale-[0.98] text-black font-semibold px-6 py-5 neon-orange"
          {...triggerProps}
        >
          <Flame className="mr-2 h-4 w-4" />
          Sign in with Xaman
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md glass-card border-white/10" data-testid="xaman-login-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[hsl(var(--phoenix-orange))]" />
            Sign in with Xaman
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Scan the QR with your Xaman wallet and approve the SignIn request.
          </DialogDescription>
        </DialogHeader>

        {!payload ? (
          <div className="flex items-center justify-center py-10">
            <div className="text-muted-foreground">Creating payload…</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-black/40 border border-white/10 p-4 flex items-center gap-3">
              <div className="shrink-0 h-24 w-24 rounded-lg bg-white flex items-center justify-center" data-testid="xaman-login-qr-container">
                {/* XUMM QR URL renders a plain page; we proxy to qr-server for a real scannable image */}
                <img
                  alt="Xaman QR"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload.qr_url)}`}
                  className="h-full w-full"
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-xs text-muted-foreground">Payload UUID</div>
                <div className="font-mono text-[11px] break-all text-white/80">{payload.payload_uuid}</div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="secondary" onClick={copy} data-testid="xaman-login-copy-url">
                    {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    Copy link
                  </Button>
                  <a
                    href={payload.deeplink}
                    className="text-xs text-[hsl(var(--electric-blue))] underline"
                    data-testid="xaman-login-deeplink"
                  >
                    Open in Xaman
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-[hsl(var(--phoenix-orange))]/30 bg-[hsl(var(--phoenix-orange))]/5 p-4">
              <div className="flex items-start gap-2 text-xs text-white/80">
                <AlertCircle className="h-4 w-4 text-[hsl(var(--phoenix-orange))] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[hsl(var(--phoenix-orange))]">Mock mode active</div>
                  Provide any valid XRPL address (starts with <span className="font-mono">r…</span>) to simulate a signed payload.
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  data-testid="xaman-login-mock-address-input"
                  className="font-mono text-xs bg-black/40 border-white/10"
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  placeholder="rExampleAddress…"
                />
                <Button
                  data-testid="xaman-login-mock-resolve"
                  onClick={resolveMock}
                  disabled={busy}
                  className="bg-[hsl(var(--phoenix-orange))] text-black hover:brightness-110"
                >
                  Simulate Sign
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-start">
          <div className="text-xs text-muted-foreground">
            Secrets stay on the server. We only ask for your public XRPL address.
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
