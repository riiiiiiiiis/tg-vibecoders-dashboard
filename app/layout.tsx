export const metadata = { title: 'Telegram Dashboard' };

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Legacy CSS removed; using Tailwind-based globals */}
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}


