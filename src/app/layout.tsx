import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sound Of Wall",
  description: "Turn sound into collectible artwork",
  openGraph: {
    title: "Sound Of Wall",
    description: "Turn sound into collectible artwork",
    siteName: "Sound Of Wall",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sound Of Wall",
    description: "Turn sound into collectible artwork",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0a0a0f] antialiased`}>
        {children}
      </body>
    </html>
  );
}
