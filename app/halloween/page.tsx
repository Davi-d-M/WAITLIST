import Link from 'next/link';
import { getMidnightMarketOrigin } from '../marketplace';
import HalloweenCatalog, { type CatalogProduct, type ShopCategory } from './HalloweenCatalog';

export const dynamic = 'force-dynamic';

type CatalogResponse = {
  products: CatalogProduct[];
  categories: ShopCategory[];
  campaign?: { title: string; message: string } | null;
  storefront?: {
    eyebrow: string;
    title: string;
    subtitle: string;
    collectionEyebrow: string;
    collectionTitle: string;
    searchPlaceholder: string;
    categoriesLabel: string;
    countdownLabel: string;
    countdownEndsAt: string | null;
    showPreviewDesigns: boolean;
  } | null;
  error?: string;
};

export default async function HalloweenShopPage() {
  const origin = getMidnightMarketOrigin(process.env.NEXT_PUBLIC_MIDNIGHT_MARKET_URL);
  if (!origin) {
    return <ShopUnavailable message="The costume catalog address is invalid. Please contact support." />;
  }

  let catalog: CatalogResponse = { products: [], categories: [] };
  let catalogError: string | undefined;
  try {
    const response = await fetch(new URL('/api/market/catalog', origin), { cache: 'no-store' });
    const result = await response.json() as CatalogResponse;
    if (!response.ok) {
      console.error('[HalloweenShop] Catalog request failed:', response.status, result.error);
      catalogError = result.error || 'The costume catalog is temporarily unavailable.';
    } else if (!Array.isArray(result.products) || !Array.isArray(result.categories)) {
      console.error('[HalloweenShop] Catalog response did not contain product and category lists.');
      catalogError = 'The costume catalog returned an invalid response. Please try again shortly.';
    } else {
      catalog = result;
    }
  } catch (cause) {
    console.error('[HalloweenShop] Could not connect to the costume catalog:', cause);
    catalogError = 'The costume catalog could not be reached. Please try again shortly.';
  }

  return (
    <main className="site-shell halloween-shop">
      <nav className="topbar">
        <Link className="brand" href="/" aria-label="Midnight Society home">
          <span className="brand-mark">MS</span>
          <span>MIDNIGHT SOCIETY <span className="brand-sub">KENYA | AFTER DARK</span></span>
        </Link>
        <Link className="market-top-link" href="/">Join the list <span aria-hidden="true">→</span></Link>
      </nav>
      <HalloweenCatalog
        products={catalog.products}
        categories={catalog.categories}
        campaign={catalog.campaign}
        storefront={catalog.storefront}
        origin={origin}
        catalogError={catalogError}
      />
      <footer className="halloween-shop-footer">
        <span>Midnight Market · Costumes from local merchants</span>
        <a href={`${origin}/merchant/register`}>Sell on Midnight Market</a>
      </footer>
    </main>
  );
}

function ShopUnavailable({ message }: { message: string }) {
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
        <p role="status">{message}</p>
        <Link className="button button-primary" href="/">Back to Midnight Society</Link>
      </section>
    </main>
  );
}
