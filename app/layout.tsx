import type { Metadata } from 'next';
import './globals.css';
import { PwaInstallProvider } from './pwa-install-provider';

export const metadata: Metadata = {
  title: 'Online Bar | Early Access',
  description: 'Join the Online Bar early-access list, invite friends, earn tokens and see what you can redeem.',
  applicationName: 'OB',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><PwaInstallProvider>{children}</PwaInstallProvider></body>
    </html>
  );
}
