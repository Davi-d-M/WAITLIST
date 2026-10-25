'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

export type ShopCategory = { name: string; slug: string; description: string | null };

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  availabilityStatus: 'available_now' | 'planned' | 'made_to_order';
  description: string | null;
  merchant: { name: string; slug: string };
  category: { name: string; slug: string } | null;
  variants: Array<{
    id: string;
    size: string | null;
    priceMinor: number;
    salePriceMinor: number | null;
    currency: string;
    availableQuantity: number;
    inStock: boolean;
  }>;
  images: Array<{ url: string; alt: string; mediaType: 'image' | 'video' }>;
};

function priceFor(product: CatalogProduct) {
  const prices = product.variants.map(variant => variant.salePriceMinor ?? variant.priceMinor);
  return prices.length ? Math.min(...prices) : null;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount / 100);
}

export default function HalloweenCatalog({
  products,
  categories,
  origin
}: {
  products: CatalogProduct[];
  categories: ShopCategory[];
  origin: string;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const filteredProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return products.filter(product => {
      const matchesCategory = !category || product.category?.slug === category;
      const searchable = `${product.name} ${product.description || ''} ${product.merchant.name} ${product.category?.name || ''}`.toLocaleLowerCase();
      return matchesCategory && (!search || searchable.includes(search));
    });
  }, [category, products, query]);

  return (
    <section className="halloween-shop-catalog" aria-label="Halloween costumes and accessories">
      <div className="halloween-shop-tools">
        <label>
          <span className="sr-only">Search costumes</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search costumes, themes, sellers…" />
        </label>
        <label>
          <span className="sr-only">Filter by category</span>
          <select value={category} onChange={event => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </label>
        <p role="status">{filteredProducts.length} {filteredProducts.length === 1 ? 'listing' : 'listings'}</p>
      </div>

      {filteredProducts.length ? (
        <div className="halloween-product-grid">
          {filteredProducts.map(product => {
            const image = product.images.find(item => item.mediaType === 'image');
            const price = priceFor(product);
            const currency = product.variants[0]?.currency || 'KES';
            const inStock = product.variants.some(variant => variant.inStock);
            const status = product.availabilityStatus === 'planned'
              ? 'Coming soon'
              : product.availabilityStatus === 'made_to_order'
                ? 'Made to order'
                : inStock ? 'Available now' : 'Temporarily unavailable';
            return (
              <article className="halloween-product-card" key={product.id}>
                <a href={`${origin}/shop/product/${encodeURIComponent(product.slug)}`} className="halloween-product-image" aria-label={`View ${product.name}`}>
                  {image
                    ? <Image src={image.url} alt={image.alt || product.name} fill sizes="(max-width: 680px) 100vw, (max-width: 1000px) 50vw, 33vw" unoptimized />
                    : <span>Costume photo coming soon</span>}
                </a>
                <div className="halloween-product-info">
                  <p className="halloween-product-meta">{product.category?.name || 'Halloween'} · {product.merchant.name}</p>
                  <h2><a href={`${origin}/shop/product/${encodeURIComponent(product.slug)}`}>{product.name}</a></h2>
                  <p className="halloween-product-description">{product.description || 'A Halloween find from a local merchant.'}</p>
                  <div className="halloween-product-bottom">
                    <strong>{price === null ? 'Ask seller' : formatMoney(price, currency)}</strong>
                    <span>{status}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="halloween-shop-empty">
          <p className="eyebrow">THE MARKET IS OPENING</p>
          <h2>{products.length ? 'No costumes match that search.' : 'No costumes have been published yet.'}</h2>
          <p>{products.length
            ? 'Try another costume name, theme or category.'
            : 'Approved merchant listings appear here once a seller publishes a costume or accessory.'}</p>
        </div>
      )}
    </section>
  );
}
