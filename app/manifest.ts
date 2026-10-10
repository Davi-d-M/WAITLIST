import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Online Bar Launch Dashboard',
    short_name: 'OB',
    description: 'Your launch countdown, invite progress and souvenir tokens.',
    start_url: '/widget',
    scope: '/',
    display: 'standalone',
    background_color: '#F9F4EC',
    theme_color: '#D91C1C',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
