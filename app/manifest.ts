import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Online Bar Launch Dashboard',
    short_name: 'Online Bar',
    description: 'Your launch countdown, invite progress and souvenir tokens.',
    start_url: '/widget',
    scope: '/',
    display: 'standalone',
    background_color: '#F9F4EC',
    theme_color: '#D91C1C',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
    ]
  };
}
