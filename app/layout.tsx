import type { Metadata } from 'next';
import './globals.css';
import { PwaInstallProvider } from './pwa-install-provider';

export const metadata: Metadata = {
  title: 'Midnight Society KE | Your invitation starts here',
  description: 'Some nights become stories. Join Midnight Society KE for confirmed launch, music and experience updates. Presented by ONLINE BAR.',
  applicationName: 'Midnight Society KE',
  openGraph: {
    title: 'Midnight Society KE',
    description: 'Some nights become stories. Others become legends.',
    siteName: 'Midnight Society KE',
    locale: 'en_KE',
    type: 'website'
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icon-192.png',
    apple: '/icon-192.png'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><PwaInstallProvider>{children}</PwaInstallProvider></body>
    </html>
  );
}
