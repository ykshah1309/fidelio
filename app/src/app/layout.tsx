import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fidelio — your 401(k), translated",
  description:
    "Drop in your 401(k) statement or paystub. Claude tells you — in plain English — what you own, what you're paying in fees, and the one thing to change this week.",
  openGraph: {
    title: "Fidelio — your 401(k), translated",
    description:
      "Drop the PDF. Claude tells you what you're paying.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — runs synchronously before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fidelio-theme');document.documentElement.classList.toggle('dark',t!=='light')}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
