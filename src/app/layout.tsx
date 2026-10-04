import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Schichtwerk", template: "%s · Schichtwerk" },
  description: "Dienstpläne für Ihr Team – schnell erstellt, automatisch gespeichert, überall abrufbar.",
  applicationName: "Schichtwerk",
  appleWebApp: { capable: true, title: "Schichtwerk", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f11" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
