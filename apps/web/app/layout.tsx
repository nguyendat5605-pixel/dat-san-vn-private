import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  applicationName: "DatSanVN",
  title: {
    default: "DatSanVN",
    template: "%s | DatSanVN",
  },
  description:
    "Nền tảng đặt sân bóng đá với trải nghiệm tìm kiếm nhanh và giao diện mobile-first.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DatSanVN",
  },
};

export const viewport: Viewport = {
  themeColor: "#11502a",
  width: "device-width",
  initialScale: 1,
};

import { InstallPrompt } from "@/components/layout/install-prompt";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)] antialiased`}
      >
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        >
          {children}
          <Toaster />
          <InstallPrompt />
        </ClerkProvider>
      </body>
    </html>
  );
}
