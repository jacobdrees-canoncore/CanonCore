import type { Metadata } from "next";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";

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
      {/*
       * NO FONT IS DECLARED HERE, which is a deletion rather than an omission
       * (CNCORE-161). The generator hung `Geist` and `Geist_Mono` on this
       * element as CSS variables and no stylesheet ever read either one --
       * `globals.css` resolves `--font-sans` to `"Inter Variable"` -- so two
       * families were subsetted into the build and declared in the sheet every
       * page links, to be rendered in by nothing. The type comes from
       * `packages/ui`'s stylesheet, and a face this app self-hosts would be
       * declared there beside the tokens rather than here.
       */}
      <body className="antialiased">
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
