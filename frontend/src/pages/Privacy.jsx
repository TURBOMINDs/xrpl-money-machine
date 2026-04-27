import { TopNav } from '@/components/TopNav';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="relative bg-cinematic min-h-screen flex flex-col" data-testid="page-privacy">
      <TopNav />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
        <Link to="/" className="text-xs text-muted-foreground hover:text-white inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[hsl(var(--electric-blue))]" />
          <h1 className="font-display text-3xl sm:text-4xl">Privacy Policy</h1>
        </div>
        <p className="text-xs text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        <Card className="rounded-2xl glass-card p-6 space-y-5 text-sm leading-relaxed text-white/85">
          <Section title="What we collect">
            When you sign in with Xaman we receive your <span className="font-mono">public XRPL
            address</span>. We do <span className="text-emerald-300">not</span> receive your private keys, seed phrase, or any
            information that allows us to move funds on your behalf. We may store
            non-sensitive operational data such as: tracked AMM addresses you
            add, alert preferences you configure, your subscription tier and
            renewal status, OneSignal device subscription IDs (if you opt-in to
            push notifications), and basic timestamps.
          </Section>
          <Section title="What we do not do">
            <ul className="list-disc list-inside space-y-1">
              <li>We do <span className="text-emerald-300">not</span> sell, rent, or share your wallet address with third parties for marketing.</li>
              <li>We do <span className="text-emerald-300">not</span> publicly expose individual wallet addresses on the platform.</li>
              <li>Subscription stats shown publicly (“X wallets joined”, “X active traders”, etc.)
                  are <span className="font-mono">aggregated counts only</span> — never address lists.</li>
              <li>We do <span className="text-emerald-300">not</span> display the dollar value of your portfolio or your trading P&amp;L on public pages.</li>
            </ul>
          </Section>
          <Section title="Why we store wallet addresses privately">
            Your XRPL address is used internally to (a) authenticate you, (b)
            associate your subscription tier and tracking slots with your
            account, (c) verify on-chain payments to the community wallet, (d)
            classify whale activity tiers, and (e) prevent abuse (rate limiting,
            duplicate-tracking enforcement, etc.). It is never shown publicly
            outside your own dashboard.
          </Section>
          <Section title="Notifications (OneSignal)">
            If you choose to enable browser/web push notifications, we use
            OneSignal as a delivery provider. OneSignal stores a device-bound
            subscription identifier we link to your account so we can target
            whale, liquidity, and price alerts to your subscribed devices. You
            can revoke this at any time from your browser settings or the
            “Notifications” toggle inside the app. We do not transmit your XRPL
            address inside push payloads.
          </Section>
          <Section title="Cookies and local storage">
            We set a single httpOnly authentication cookie (“umm_token”) and may
            use localStorage to keep you signed in. We use OneSignal&apos;s service
            worker for push delivery. We do not use third-party advertising
            cookies.
          </Section>
          <Section title="Public, on-chain data">
            All XRP Ledger transactions are public by design. The Service surfaces
            public on-chain data such as AMM pool balances, trading fees, and
            transactions touching tracked AMMs. Anyone can independently inspect
            the same data on a public XRPL explorer.
          </Section>
          <Section title="Your choices">
            You can delete your tracked pairs and alerts at any time from the
            dashboard. To request deletion of your account and associated data,
            contact us via the project channels published on the landing page.
          </Section>
          <Section title="Security">
            All Xaman API calls are made server-side using secrets that never
            reach your browser. Webhook callbacks from Xaman are signature-verified
            with HMAC. Liquidity execution transactions are signed server-side and
            are kept in dry-run mode until explicitly activated by the operator.
          </Section>
          <Section title="Changes">
            We may update this Privacy Policy from time to time. Material changes
            will be announced in-app. Continued use of the Service after changes
            constitutes acceptance.
          </Section>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="font-display text-base uppercase tracking-widest text-[hsl(var(--electric-blue))] mb-2">
        {title}
      </h2>
      <div>{children}</div>
    </div>
  );
}
