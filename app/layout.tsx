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
        {/* Monetag Vignette — in-page overlay, no popups */}
        <Script
          id="monetag-vignette"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(s){s.dataset.zone='10919687',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`,
          }}
        />
      </body>
    </html>
  );
}
