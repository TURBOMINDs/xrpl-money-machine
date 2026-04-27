import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';

export function Footer() {
  return (
    <footer
      data-testid="app-footer"
      className="relative mt-10 border-t border-white/10 bg-black/30"
    >
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Flame className="h-3.5 w-3.5 text-[hsl(var(--phoenix-orange))]" />
          <span>© {new Date().getFullYear()} XRPL Universal Money Machine</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Not financial advice.</span>
        </div>
        <nav className="flex items-center gap-4 text-xs">
          <Link
            to="/terms"
            data-testid="footer-terms-link"
            className="text-muted-foreground hover:text-[hsl(var(--phoenix-orange))] underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            data-testid="footer-privacy-link"
            className="text-muted-foreground hover:text-[hsl(var(--phoenix-orange))] underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          <a
            href="https://livenet.xrpl.org/accounts/rJkpUojYKYArCRkrdDhaSMZzTw77r1UiMC"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-[hsl(var(--electric-blue))] underline-offset-4 hover:underline"
            data-testid="footer-community-wallet-link"
          >
            Community Wallet
          </a>
        </nav>
      </div>
    </footer>
  );
}
