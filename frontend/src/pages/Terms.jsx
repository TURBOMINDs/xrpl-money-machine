import { TopNav } from '@/components/TopNav';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { ScrollText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="relative bg-cinematic min-h-screen flex flex-col" data-testid="page-terms">
      <TopNav />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
        <Link to="/" className="text-xs text-muted-foreground hover:text-white inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-[hsl(var(--phoenix-orange))]" />
          <h1 className="font-display text-3xl sm:text-4xl">Terms of Service</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>
        <Card className="rounded-2xl glass-card p-6 space-y-5 text-sm leading-relaxed text-white/85">
          <Section title="1. About this service">
            XRPL Universal Money Machine (“the Service”, “we”, “us”) is an
            informational and alerting tool for the XRP Ledger ecosystem. The
            Service surfaces public on-chain data, AMM tracking, whale activity
            classification, and price alerts. The Service is provided <span className="text-[hsl(var(--phoenix-orange))]">for informational purposes only</span> and does
            not constitute brokerage, custody, exchange, or investment-advice services.
          </Section>
          <Section title="2. No financial advice">
            Nothing displayed by the Service — including alerts, charts, ranks,
            statistics, liquidity activity, or commentary — constitutes financial,
            investment, tax, or legal advice. You are solely responsible for any
            decisions you make based on information obtained from the Service.
          </Section>
          <Section title="3. No guaranteed profits">
            Cryptocurrency markets are highly volatile. <span className="text-[hsl(var(--neon-red))]">No outcome, return, or profit is
            guaranteed.</span> Alerts may be delayed, missed, mis-classified, or contain
            errors. Past performance is not indicative of future results.
          </Section>
          <Section title="4. Subscriptions">
            Paid subscriptions (Basic, Plus, Ultimate Pro) grant access to
            enhanced tracking slots, alerts, and feature tiers. Subscriptions are
            paid in XRP via Xaman to a community/treasury wallet. Because
            blockchain transactions are <span className="text-[hsl(var(--phoenix-orange))]">irreversible</span>, completed payments cannot be
            refunded. You may cancel future renewals at any time.
          </Section>
          <Section title="5. XEMA liquidity support">
            A discretionary portion of platform revenue (currently 65%) may be
            allocated by the operator toward XEMA ecosystem liquidity support and
            market activity. This activity is voluntary, discretionary, and is
            not a guarantee, security, or investment contract. Allocations,
            schedules, and execution may change at any time.
          </Section>
          <Section title="6. Wallet, keys, and self-custody">
            The Service never asks for, stores, or transmits your private keys or
            seed phrase. You are solely responsible for the security of your
            wallet, your devices, and any transactions you sign. We use Xaman
            (XUMM) for wallet sign-in and payment intent signing; we are not
            affiliated with Xaman.
          </Section>
          <Section title="7. Acceptable use">
            You agree not to attempt to disrupt, scrape excessively, reverse
            engineer, or use the Service to facilitate unlawful activity. We may
            suspend access for abuse, fraud, or repeated violations.
          </Section>
          <Section title="8. Disclaimers">
            The Service is provided <span className="font-mono">“as-is”</span> and
            <span className="font-mono"> “as-available”</span>. To the maximum extent permitted by law, we
            disclaim all warranties, express or implied, including merchantability
            and fitness for a particular purpose. Use at your own risk.
          </Section>
          <Section title="9. Limitation of liability">
            To the maximum extent permitted by law, our aggregate liability for
            any claim arising out of the Service is limited to the amount you
            paid to us in the prior 12 months, or USD $50, whichever is greater.
          </Section>
          <Section title="10. Changes">
            We may update these Terms from time to time. Material changes will be
            announced in-app. Continued use of the Service after changes
            constitutes acceptance.
          </Section>
          <Section title="11. Contact">
            Questions: reach out via the project channels published on the
            landing page.
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
      <h2 className="font-display text-base uppercase tracking-widest text-[hsl(var(--phoenix-orange))] mb-2">
        {title}
      </h2>
      <p>{children}</p>
    </div>
  );
}
