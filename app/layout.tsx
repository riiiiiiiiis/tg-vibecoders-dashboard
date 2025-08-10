export const metadata = { title: 'Telegram Dashboard' };

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head />
      <body className="min-h-screen bg-gray-100 text-gray-900 font-mono">
        <header className="border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 sm:px-8 py-3 text-sm text-gray-600 flex gap-3">
            <a href="/">Home</a>
            <a href="/report/dev">Report Dev</a>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}


