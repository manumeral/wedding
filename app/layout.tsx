import type { Metadata } from "next";
import { Inter, Playfair_Display, Dancing_Script } from "next/font/google";
import "./globals.css";
import { PushNotificationsPrompt } from "@/components/PushNotificationsPrompt";
import { site } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dancing = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing",
  display: "swap",
});

export const metadata: Metadata = {
  title: site.meta.title,
  description: site.meta.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${dancing.variable}`}>
      <body className="font-sans bg-ivory text-stone-800 antialiased">
        {children}
        <PushNotificationsPrompt />
      </body>
    </html>
  );
}
