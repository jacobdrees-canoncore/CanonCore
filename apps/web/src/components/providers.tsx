"use client";

/**
 * WHAT WRAPS EVERY PAGE. The theme, and nothing else.
 *
 * The generator also put a TanStack Query client, its devtools and a Toaster
 * here, all three feeding the health-check panel on its banner page. That page
 * is gone and the surfaces that replaced it read the router IN-PROCESS as
 * server components, so nothing was left calling any of them -- and a data
 * layer with no callers is scaffold however well it works. ADR-0053: own the
 * output, which includes deleting the parts of it this product does not use.
 *
 * The slice that first needs a mutation from the browser (CNCORE-68 imports
 * from the page) adds back what it actually needs, rather than inheriting a
 * guess made by a generator.
 */
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
