import type { Metadata } from 'next';
import './globals.css';
import { PwaInstallProvider } from './pwa-install-provider';

export const metadata: Metadata = {
  title: 'Online Bar | Early Access',
  description: 'Join the Online Bar early-access list, invite friends, earn tokens and see what you can redeem.',
  applicationName: 'OB',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' }
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
