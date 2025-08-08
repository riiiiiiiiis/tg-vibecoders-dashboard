export const metadata = { title: 'Telegram Dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="stylesheet" href="/assets/style.css" />
        <script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script>
        <script src="/assets/dashboard.js" defer></script>
      </head>
      <body>{children}</body>
    </html>
  );
}


