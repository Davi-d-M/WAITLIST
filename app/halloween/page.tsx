import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMidnightMarketOrigin } from '../marketplace';

export const dynamic = 'force-dynamic';

export default function HalloweenShopRedirectPage() {
  const marketOrigin = getMidnightMarketOrigin(process.env.NEXT_PUBLIC_MIDNIGHT_MARKET_URL);
  const destination = marketOrigin ? new URL('/halloween', marketOrigin).toString() : null;

  if (destination) redirect(destination);

  return (
    <main className="site-shell">
      <nav className="topbar">
        <Link className="brand" href="/" aria-label="Midnight Society home">
          <span className="brand-mark">MS</span>
          <span>MIDNIGHT SOCIETY <span className="brand-sub">KENYA | AFTER DARK</span></span>
        </Link>
      </nav>
      <section className="market-shop-unavailable">
        <p className="eyebrow">MIDNIGHT MARKET · HALLOWEEN</p>
        <h1>The costume shop is getting ready.</h1>
        <p>The Halloween storefront is not connected to this deployment yet. Please check back soon.</p>
        <Link className="button button-primary" href="/">Back to Midnight Society</Link>
      </section>
    </main>
  );
}
