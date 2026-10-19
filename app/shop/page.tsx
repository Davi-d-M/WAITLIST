import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ShopRedirectPage() {
  let destination: string | null = null;
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_MIDNIGHT_MARKET_URL || '');
    if (['http:', 'https:'].includes(configured.protocol) && !configured.username && !configured.password) {
      destination = new URL('/shop', configured.origin).toString();
    }
  } catch {
    destination = null;
  }

  if (destination) redirect(destination);

  return (
    <main className="site-shell">
      <nav className="topbar">
        <Link className="brand" href="/" aria-label="Midnight Society home">
          <span className="brand-mark">✦</span>
          <span> MIDNIGHT SOCIETY <span className="brand-sub">KENYA · AFTER DARK</span></span>
        </Link>
      </nav>
      <section className="market-shop-unavailable">
        <p className="eyebrow">MIDNIGHT MARKET</p>
        <h1>The shop is getting ready.</h1>
        <p>The customer storefront is not connected to this deployment yet. Please check back soon.</p>
        <Link className="button button-primary" href="/">Back to Midnight Society <span>↗</span></Link>
      </section>
    </main>
  );
}
