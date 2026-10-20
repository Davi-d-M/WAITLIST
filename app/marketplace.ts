export const DEFAULT_MIDNIGHT_MARKET_ORIGIN = 'https://halloween-kohl-tau.vercel.app';

export function getMidnightMarketOrigin(configuredUrl: string | undefined) {
  if (!configuredUrl?.trim()) return DEFAULT_MIDNIGHT_MARKET_ORIGIN;

  try {
    const configured = new URL(configuredUrl.trim());
    if (!['http:', 'https:'].includes(configured.protocol) || configured.username || configured.password) {
      return null;
    }
    return configured.origin;
  } catch {
    return null;
  }
}
