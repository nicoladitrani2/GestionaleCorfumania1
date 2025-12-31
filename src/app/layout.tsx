import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWAInstallPrompt from "./dashboard/PWAInstallPrompt";
import PWALifecycle from "./PWALifecycle";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestionale Corfumania",
  description: "Sistema di gestione escursioni e partecipanti",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Corfumania",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="pwa-prompt-handler" strategy="beforeInteractive">
          {`
            window.deferredPrompt = null;
            window.addEventListener('beforeinstallprompt', (e) => {
              e.preventDefault();
              window.deferredPrompt = e;
              console.log('beforeinstallprompt captured by script');
              window.dispatchEvent(new Event('pwa-prompt-ready'));
            });
          `}
        </Script>
        <PWALifecycle />
        <PWAInstallPrompt />
        {children}
      </body>
    </html>
  );
}
