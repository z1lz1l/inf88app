import "./globals.css";
import { Metadata } from "next";
import { WalletProvider } from "@/lib/wallet";
import Script from "next/script";

export const viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "88inf — Earn & Pay",
  description: "Earn 88INF tokens and pay at local businesses",
  icons: {
    icon: "/coin.jpg",
    apple: "/coin.jpg",
    shortcut: "/coin.jpg",
  },
  openGraph: {
    title: "Infinity88 ($INF88$)",
    description: "Earn tokens. Pay anywhere.",
    images: ["/coin.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/*
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXXX"
          crossOrigin="anonymous"
        />
        */}
      </head>
      <body style={{ margin: 0, padding: 0, background: "#080808" }}>
        <WalletProvider>
          {children}
        </WalletProvider>
        {/* Monetag Multitag — covers all ad formats automatically */}
        <Script
          id="monetag-multitag"
          strategy="afterInteractive"
          src="https://quge5.com/88/tag.min.js"
          data-zone="233125"
          data-cfasync="false"
        />
      </body>
    </html>
  );
}
