'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

export type ShopCategory = { name: string; slug: string; description: string | null };

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  availabilityStatus: 'available_now' | 'planned' | 'made_to_order';
  description: string | null;
  attributes?: Record<string, string>;
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

type Costume = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  currency?: string;
  oldPrice?: number;
  sizes: string[];
  fitNote: string;
  badges: string[];
  palette: [string, string, string];
  merchant: string;
  image?: string;
  isPreview: boolean;
};

type CartLine = { productId: string; size: string; quantity: number };
type Dialog = 'fit' | 'photo' | 'bag' | 'preview' | null;

const themes = ['All', 'Witch', 'Vampire', 'Space', 'Masquerade', 'Hero', 'Classic'];
const cartStorageKey = 'waitlist-halloween-lookbook-v1';
const previewCostumes: Costume[] = [
  { id: 'preview-9101', slug: '', name: 'Midnight Witch Set', category: 'Witch', description: 'High-coverage velvet dress, oversized hat, and layered cape for dramatic party energy.', price: 3200, oldPrice: 4200, sizes: ['XS', 'S', 'M', 'L', 'XL'], fitNote: 'Best for slim-to-average builds and a slightly oversized silhouette.', badges: ['3D view', 'Best seller'], palette: ['#2f1b52', '#8b5cf6', '#f5d0fe'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9102', slug: '', name: 'Blood Moon Vampire', category: 'Vampire', description: 'Dark satin cape with velvet collar and arched details for a sleek, night-ready look.', price: 3600, oldPrice: 4700, sizes: ['S', 'M', 'L', 'XL'], fitNote: 'Designed for a fitted waist with a long cape for movement.', badges: ['Try-on ready', 'VIP'], palette: ['#1f2937', '#dc2626', '#fca5a5'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9103', slug: '', name: 'Cosmic Ranger', category: 'Space', description: 'Futuristic suit with metallic trims and reflective shoulder plating for bold club looks.', price: 3900, oldPrice: 5100, sizes: ['S', 'M', 'L', 'XL'], fitNote: 'Roomy in the shoulders and slightly tapered at the waist.', badges: ['New drop', '3D view'], palette: ['#0f172a', '#38bdf8', '#dbeafe'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9104', slug: '', name: 'Masquerade Elegance', category: 'Masquerade', description: 'Gold embroidery, sleek silhouette, and layered mask details for elegant costume nights.', price: 4100, oldPrice: 5300, sizes: ['XS', 'S', 'M', 'L'], fitNote: 'A fitted statement piece with a stretch lining for comfort.', badges: ['Limited'], palette: ['#1f2937', '#fbbf24', '#fef3c7'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9105', slug: '', name: 'Urban Hero', category: 'Hero', description: 'Comfy hero outfit with utility panels, cape accents, and padded chest detailing.', price: 3500, oldPrice: 4500, sizes: ['M', 'L', 'XL', 'XXL'], fitNote: 'Relaxed through the torso and arm for movement and layering.', badges: ['Quick ship', 'Popular'], palette: ['#111827', '#f97316', '#fef2f2'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9106', slug: '', name: 'Classic Ghost Bride', category: 'Classic', description: 'A sheer layered dress with lace trim and soft ivory finish for a dramatic ghostly look.', price: 3700, oldPrice: 4900, sizes: ['XS', 'S', 'M', 'L', 'XL'], fitNote: 'Soft drape with a flattering waist line and floating skirt shape.', badges: ['Classic favorite'], palette: ['#f8fafc', '#cbd5e1', '#e2e8f0'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9107', slug: '', name: 'Moonlit Enchantress', category: 'Witch', description: 'Silk-lined robe, layered sleeves, and luminous accessories for an enchanted night out.', price: 3400, oldPrice: 4400, sizes: ['S', 'M', 'L', 'XL'], fitNote: 'Flattering for a soft waist and roomy movement in the sleeves.', badges: ['New', 'Glow detail'], palette: ['#2a0b3d', '#c084fc', '#f5e7ff'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9108', slug: '', name: 'Cemetery Queen', category: 'Vampire', description: 'Tailored velvet gown with dramatic collar and statement mossy accents.', price: 4200, oldPrice: 5400, sizes: ['XS', 'S', 'M', 'L', 'XL'], fitNote: 'Designed to sit close at the waist with a flowing dramatic skirt.', badges: ['Luxury', 'Sold out soon'], palette: ['#111827', '#b91c1c', '#f5d0d0'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9109', slug: '', name: 'Neon Outlaw', category: 'Space', description: 'Reflective bodysuit with utility harness and a runway-ready metallic finish.', price: 3800, oldPrice: 5000, sizes: ['XS', 'S', 'M', 'L'], fitNote: 'Graceful through the torso with flexible movement in the arms.', badges: ['Party favorite'], palette: ['#0f172a', '#06b6d4', '#cffafe'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9110', slug: '', name: 'Velvet Masquerade', category: 'Masquerade', description: 'Rich jewel tones, feathered trim, and expressive mask details for premium events.', price: 4300, oldPrice: 5600, sizes: ['S', 'M', 'L', 'XL'], fitNote: 'A flattering fitted shape with a soft stretch lining.', badges: ['Premium'], palette: ['#1f2937', '#d97706', '#fef3c7'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9111', slug: '', name: 'Skyblade Guardian', category: 'Hero', description: 'Crisp armor-style outfit with layered cape and costume-ready utility accents.', price: 3600, oldPrice: 4700, sizes: ['M', 'L', 'XL'], fitNote: 'Relaxed structure for movement and layered jackets.', badges: ['Fast ship'], palette: ['#111827', '#f97316', '#ffedd5'], merchant: 'Costume preview', isPreview: true },
  { id: 'preview-9112', slug: '', name: 'Pearl Phantom', category: 'Classic', description: 'A pearlescent, floating silhouette and soft lace finish with a vintage ghost story feel.', price: 3900, oldPrice: 5000, sizes: ['XS', 'S', 'M', 'L', 'XL'], fitNote: 'Loose and elegant with a forgiving waist and soft drape.', badges: ['Classic', 'Vintage'], palette: ['#e2e8f0', '#cbd5e1', '#f8fafc'], merchant: 'Costume preview', isPreview: true }
];

function mapProduct(product: CatalogProduct): Costume {
  const sizes = [...new Set(product.variants.map(variant => variant.size).filter((size): size is string => Boolean(size)))];
  const attributes = product.attributes || {};
  const inStock = product.variants.some(variant => variant.inStock);
  const availabilityBadge = product.availabilityStatus === 'planned'
    ? 'Coming soon'
    : product.availabilityStatus === 'made_to_order'
      ? 'Made to order'
      : inStock ? 'Available now' : 'Temporarily unavailable';
  return {
    id: `market-${product.id}`,
    slug: product.slug,
    name: product.name,
    category: product.category?.name || 'Halloween',
    description: product.description || 'A costume listing from an approved Midnight Market merchant.',
    price: product.variants.length
      ? Math.min(...product.variants.map(variant => variant.salePriceMinor ?? variant.priceMinor)) / 100
      : 0,
    currency: product.variants[0]?.currency || 'KES',
    sizes: sizes.length ? sizes : ['One size'],
    fitNote: attributes.fit_note || attributes.size_guide || 'Check the product page for the seller’s sizing details.',
    badges: [availabilityBadge],
    palette: paletteFor(product.category?.name || ''),
    merchant: product.merchant.name,
    image: product.images.find(image => image.mediaType === 'image')?.url,
    isPreview: false
  };
}

function paletteFor(category: string): [string, string, string] {
  const palettes: Record<string, [string, string, string]> = {
    witch: ['#2f1b52', '#8b5cf6', '#f5d0fe'],
    vampire: ['#1f2937', '#dc2626', '#fca5a5'],
    space: ['#0f172a', '#38bdf8', '#dbeafe'],
    masquerade: ['#1f2937', '#fbbf24', '#fef3c7'],
    hero: ['#111827', '#f97316', '#fef2f2'],
    classic: ['#f8fafc', '#cbd5e1', '#e2e8f0']
  };
  return palettes[category.toLowerCase()] || palettes.classic;
}

function money(amount: number, currency = 'KES') {
  return amount > 0
    ? new Intl.NumberFormat('en-KE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
    : 'Ask seller';
}

function readCart(): CartLine[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(cartStorageKey) || '[]');
    return Array.isArray(value) ? value.filter((line): line is CartLine =>
      Boolean(line) && typeof line.productId === 'string' && typeof line.size === 'string'
      && Number.isSafeInteger(line.quantity) && line.quantity > 0
    ) : [];
  } catch {
    console.warn('[WaitlistHalloween] The saved costume bag was invalid and will be ignored.');
    return [];
  }
}

export default function HalloweenCatalog({
  products,
  categories,
  origin,
  catalogError
}: {
  products: CatalogProduct[];
  categories: ShopCategory[];
  origin: string;
  catalogError?: string;
}) {
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('All');
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selected, setSelected] = useState<Costume | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [fit, setFit] = useState({ height: 170, weight: 68 });
  const [fitSize, setFitSize] = useState('');
  const [rotation, setRotation] = useState(0);

  useEffect(() => setCart(readCart()), []);
  useEffect(() => {
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch (error) {
      console.error('[WaitlistHalloween] Could not save costume bag:', error);
    }
  }, [cart]);
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const costumes = useMemo(() => {
    const marketplaceProducts = products.map(mapProduct);
    const unique = new Map<string, Costume>();
    for (const product of [...previewCostumes, ...marketplaceProducts]) unique.set(product.id, product);
    return [...unique.values()];
  }, [products]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return costumes.filter(product =>
      (theme === 'All' || product.category.toLowerCase() === theme.toLowerCase())
      && (!needle || `${product.name} ${product.category} ${product.description} ${product.merchant}`.toLocaleLowerCase().includes(needle))
    );
  }, [costumes, query, theme]);
  const bagCount = cart.reduce((total, line) => total + line.quantity, 0);
  const bagItems = cart.map(line => ({ line, product: costumes.find(product => product.id === line.productId) }))
    .filter((entry): entry is { line: CartLine; product: Costume } => Boolean(entry.product));

  function addToBag(product: Costume) {
    const size = sizes[product.id] || product.sizes[0];
    setCart(current => {
      const existing = current.find(line => line.productId === product.id && line.size === size);
      return existing
        ? current.map(line => line === existing ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { productId: product.id, size, quantity: 1 }];
    });
    setDialog('bag');
  }

  function updateQuantity(productId: string, size: string, quantity: number) {
    setCart(current => quantity < 1
      ? current.filter(line => line.productId !== productId || line.size !== size)
      : current.map(line => line.productId === productId && line.size === size ? { ...line, quantity } : line));
  }

  function closeDialog() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setDialog(null);
  }

  function showFitQuiz() {
    setFitSize('');
    setDialog('fit');
  }

  function recommendSize() {
    const { height, weight } = fit;
    setFitSize(height <= 160 || weight <= 55 ? 'XS / S' : height <= 170 && weight <= 75 ? 'S / M' : height <= 182 && weight <= 90 ? 'M / L' : 'L / XL');
  }

  function handlePhoto(file?: File) {
    setPhotoError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a JPEG, PNG, or WebP photo.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError('Choose a photo smaller than 8 MB.');
      return;
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
  }

  const activeCostume = selected;
  const cartTotal = bagItems.reduce((total, { line, product }) => total + line.quantity * product.price, 0);

  return (
    <section className="halloween-experience" aria-label="Halloween costume store">
      <header className="halloween-drop-hero">
        <div className="halloween-drop-copy">
          <span className="halloween-drop-label">✦ HALLOWEEN DROP</span>
          <h1>COSTUME STORE FOR<br /><em>THE SEASON</em></h1>
          <p>Browse costume drops, explore fit and photo previews, and discover real merchant listings when they’re published.</p>
        </div>
        <div className="halloween-drop-actions">
          <a href={`${origin}/shop`} className="halloween-pill halloween-pill-light">FULL STORE <span>→</span></a>
          <a href={`${origin}/merchant/register`} className="halloween-pill">MERCHANT PORTAL</a>
          <span className="halloween-pill halloween-countdown">◇ 7-DAY COUNTDOWN</span>
        </div>
        <div className="halloween-theme-row" role="group" aria-label="Filter costumes by theme">
          {themes.map(item => (
            <button key={item} type="button" aria-pressed={theme === item} onClick={() => setTheme(item)} className={theme === item ? 'active' : ''}>{item}</button>
          ))}
        </div>
        <label className="halloween-search">
          <span className="sr-only">Search costumes</span>
          <input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Search costumes, styles, and descriptions" />
        </label>
        <div className="halloween-shortcuts">
          <button type="button" onClick={showFitQuiz}><span>♧ SIZE GUIDE</span><strong>FIND YOUR FIT</strong></button>
          <button type="button" onClick={() => { setSelected(costumes[0] || null); setDialog('photo'); setPhotoError(''); }}><span>◎ PHOTO TRY-ON</span><strong>UPLOAD YOUR SELFIE</strong></button>
          <button type="button" onClick={() => setDialog('bag')}><span>→ SHOPPING CART · {bagCount}</span><strong>REVIEW YOUR CART</strong></button>
        </div>
      </header>

      <div className="halloween-demo-note" role="note">
        <strong>Costume previews are for browsing only.</strong> Preview designs and bag selections are not confirmed merchant inventory or an online order. Live listings below come from approved Halloween merchants; ask the seller to confirm stock, price and delivery before paying.
        {catalogError && <span className="halloween-catalog-status"> Live merchant listings are temporarily unavailable: {catalogError}</span>}
      </div>

      {categories.length > 0 && (
        <div className="halloween-live-categories" aria-label="Live merchant categories">
          <span>SHOP LIVE CATEGORIES</span>
          {categories.slice(0, 8).map(category => <button key={category.slug} type="button" onClick={() => { setTheme(category.name); setQuery(''); }}>{category.name}</button>)}
        </div>
      )}

      <div className="halloween-grid-heading">
        <div><span>THE COLLECTION</span><h2>Find your look.</h2></div>
        <p>{filtered.length} {filtered.length === 1 ? 'style' : 'styles'} · {products.length} live merchant {products.length === 1 ? 'listing' : 'listings'}</p>
      </div>
      {filtered.length ? (
        <div className="halloween-product-grid">
          {filtered.map(product => {
            const chosenSize = sizes[product.id] || product.sizes[0];
            return (
              <article className="halloween-product-card" key={product.id}>
                <div className="halloween-product-art" style={{ background: `linear-gradient(145deg, ${product.palette[0]}, ${product.palette[1]}, ${product.palette[2]})` }}>
                  {product.image && <Image src={product.image} alt="" fill sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" unoptimized className="halloween-card-photo" />}
                  <div className="halloween-art-badges">{(product.isPreview ? ['STYLE PREVIEW', ...product.badges] : product.badges).map(badge => <span key={badge}>{badge}</span>)}</div>
                  {!product.image && <div className={`halloween-costume-illustration ${product.category.toLowerCase()}`} aria-hidden="true"><i /><b /><em /><span /></div>}
                  <div className="halloween-product-title"><span>{product.category}</span><h3>{product.name}</h3></div>
                  <span className="halloween-size-count">{product.sizes.length} SIZES</span>
                </div>
                <div className="halloween-card-content">
                  <p className="halloween-card-description">{product.description}</p>
                  <div className="halloween-price-fit">
                    <div><strong>{money(product.price, product.currency)}</strong>{product.oldPrice && <del>{money(product.oldPrice, product.currency)}</del>}</div>
                    <span>{product.isPreview ? 'COSTUME PREVIEW' : `BY ${product.merchant.toUpperCase()}`}</span>
                  </div>
                  <p className="halloween-fit-note">FIT NOTE: {product.fitNote}</p>
                  <div className="halloween-size-row" aria-label={`Sizes for ${product.name}`}>
                    {product.sizes.map(size => <button key={size} type="button" aria-pressed={chosenSize === size} onClick={() => setSizes(current => ({ ...current, [product.id]: size }))}>{size}</button>)}
                  </div>
                  <div className="halloween-card-actions">
                    <button type="button" onClick={() => addToBag(product)}>{product.isPreview ? 'SAVE TO BAG PREVIEW' : 'ADD TO BAG'}</button>
                    <button type="button" onClick={() => { setSelected(product); setRotation(0); setDialog('preview'); }}>✧ TRY IT ON</button>
                  </div>
                  {!product.isPreview && <a className="halloween-seller-link" href={`${origin}/shop/product/${encodeURIComponent(product.slug)}`}>View live seller listing →</a>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="halloween-shop-empty"><h2>No costumes match those filters.</h2><p>Try another style, or clear your search and theme.</p><button type="button" onClick={() => { setQuery(''); setTheme('All'); }}>CLEAR SEARCH &amp; FILTERS</button></div>
      )}

      {dialog && (
        <div className="halloween-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className="halloween-dialog" role="dialog" aria-modal="true" aria-label={dialogTitle(dialog, activeCostume)} onKeyDown={event => { if (event.key === 'Escape') closeDialog(); }}>
            <div className="halloween-dialog-header"><div><span>MIDNIGHT MARKET · HALLOWEEN</span><h2>{dialogTitle(dialog, activeCostume)}</h2></div><button type="button" aria-label="Close" onClick={closeDialog}>×</button></div>
            {dialog === 'fit' && (
              <div className="halloween-dialog-body">
                <p>Share a few optional details for a basic size suggestion. It’s guidance only; always compare the merchant’s measurements.</p>
                <div className="halloween-quiz-fields">
                  <label>HEIGHT (CM)<input type="number" min="120" max="220" value={fit.height} onChange={event => setFit(current => ({ ...current, height: Number(event.target.value) }))} /></label>
                  <label>WEIGHT (KG)<input type="number" min="30" max="250" value={fit.weight} onChange={event => setFit(current => ({ ...current, weight: Number(event.target.value) }))} /></label>
                  <label>BUILD<select defaultValue="Average"><option>Slim</option><option>Average</option><option>Broad</option></select></label>
                  <label>STYLE<select><option>Fitted</option><option>Loose</option><option>Dramatic</option></select></label>
                </div>
                {fitSize && <div className="halloween-fit-result"><span>YOUR STARTING SIZE</span><strong>{fitSize}</strong><p>Confirm with the individual costume’s size chart before ordering.</p></div>}
                <button className="halloween-dialog-primary" type="button" onClick={recommendSize}>SHOW MY SIZE SUGGESTION</button>
              </div>
            )}
            {dialog === 'photo' && (
              <div className="halloween-dialog-body">
                <p>Your photo stays in this browser and is not uploaded. This is a color overlay preview, not AI garment fitting.</p>
                <div className="halloween-photo-stage">
                  {photoUrl ? <><Image src={photoUrl} alt="Your local photo preview" fill sizes="(max-width: 600px) 90vw, 450px" unoptimized />{selected && <div style={{ background: `linear-gradient(135deg, ${selected.palette[1]}88, ${selected.palette[0]}55)` }}><strong>{selected.name}</strong></div>}</> : <span>Upload a photo to preview a costume color overlay</span>}
                </div>
                <label className="halloween-photo-upload">CHOOSE A PHOTO<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => handlePhoto(event.target.files?.[0])} /></label>
                {photoError && <p role="alert" className="halloween-form-error">{photoError}</p>}
                {photoUrl && <button className="halloween-dialog-secondary" type="button" onClick={() => setPhotoUrl(null)}>REMOVE PHOTO</button>}
              </div>
            )}
            {dialog === 'preview' && activeCostume && (
              <div className="halloween-preview-layout">
                <div className="halloween-preview-scene" style={{ background: `radial-gradient(circle at 50% 36%, ${activeCostume.palette[1]}77, transparent 45%), linear-gradient(155deg, ${activeCostume.palette[0]}, #090716 78%)` }}>
                  <div className="halloween-mannequin" style={{ transform: `rotateY(${rotation}deg)` }} aria-label={`Illustrative ${activeCostume.category} costume preview`}>
                    <i className="mannequin-head" /><i className="mannequin-hat" /><i className="mannequin-body" style={{ background: `linear-gradient(110deg, ${activeCostume.palette[1]}, ${activeCostume.palette[0]} 65%, ${activeCostume.palette[2]})` }} /><i className="mannequin-cape" style={{ borderBottomColor: activeCostume.palette[1] }} /><i className="mannequin-leg left" /><i className="mannequin-leg right" />
                  </div>
                  <p>DRAG THE ROTATE BUTTON TO EXPLORE THE STYLE</p>
                  <input aria-label="Rotate costume preview" type="range" min="-45" max="45" value={rotation} onChange={event => setRotation(Number(event.target.value))} />
                </div>
                <div className="halloween-preview-details"><span>ILLUSTRATIVE PREVIEW · NOT A PHOTOREALISTIC FIT</span><h3>{activeCostume.name}</h3><strong>{money(activeCostume.price, activeCostume.currency)}</strong><p>{activeCostume.fitNote}</p><p>Available size choices: {activeCostume.sizes.join(' · ')}</p><button className="halloween-dialog-primary" type="button" onClick={() => addToBag(activeCostume)}>SAVE SIZE TO BAG PREVIEW</button></div>
              </div>
            )}
            {dialog === 'bag' && (
              <div className="halloween-dialog-body">
                {!bagItems.length ? <p>Your bag preview is empty. Pick a size and save a style to start.</p> : <>
                  <p>This is a local preview bag, not a paid order. Demo styles are not confirmed inventory.</p>
                  <div className="halloween-bag-lines">{bagItems.map(({ line, product }) => <div className="halloween-bag-line" key={`${line.productId}-${line.size}`}><div><strong>{product.name}</strong><span>{line.size} · {money(product.price, product.currency)}{product.isPreview ? ' · Preview only' : ` · ${product.merchant}`}</span>{!product.isPreview && <a href={`${origin}/shop/product/${encodeURIComponent(product.slug)}`}>Open seller listing →</a>}</div><div><button type="button" aria-label={`Remove one ${product.name}`} onClick={() => updateQuantity(line.productId, line.size, line.quantity - 1)}>−</button><span>{line.quantity}</span><button type="button" aria-label={`Add one ${product.name}`} onClick={() => updateQuantity(line.productId, line.size, line.quantity + 1)}>+</button></div></div>)}</div>
                  <div className="halloween-bag-total"><span>Preview total</span><strong>{money(cartTotal)}</strong></div>
                  {!bagItems.some(item => !item.product.isPreview) && <p className="halloween-form-error">Preview items cannot be purchased. Choose a live merchant listing to contact a seller.</p>}
                </>}
                <button className="halloween-dialog-secondary" type="button" onClick={closeDialog}>KEEP BROWSING</button>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function dialogTitle(dialog: Dialog, costume: Costume | null) {
  if (dialog === 'fit') return 'SIZE RECOMMENDER';
  if (dialog === 'photo') return 'PHOTO STYLE PREVIEW';
  if (dialog === 'bag') return 'YOUR SHOPPING BAG';
  if (dialog === 'preview') return costume?.name || 'COSTUME PREVIEW';
  return 'HALLOWEEN COSTUMES';
}
