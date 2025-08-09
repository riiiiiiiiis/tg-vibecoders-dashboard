export const metadata = { title: 'Telegram Dashboard' };

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="stylesheet" href="/assets/style.css" />
        {/* Removed external dashboard script; charts handled via client components */}
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}


