import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /*
   * THE PRODUCT'S OWN NAME (ADR-0058), which the generator left as a lowercase
   * placeholder. NO TEMPLATE: the item page sets its own title to the item's,
   * and a `%s | CanonCore` template here would append the product's name to
   * every one of them -- a tab that says what you are looking at beats one that
   * says what application you are in, on a self-hosted app with one tab open.
   */
  title: "CanonCore",
  description: "A self-hosted catalogue for collections that do not fit one folder tree.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <div className="grid grid-rows-[auto_1fr] h-svh">
            <Header />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
