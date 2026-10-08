import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Online Bar | Early Access',
  description: 'Join the Online Bar early-access list and be first to hear when we reach your area.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
