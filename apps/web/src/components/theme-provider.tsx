import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * THE THEME, PASSED STRAIGHT THROUGH.
 *
 * NO `"use client"` SINCE CNCORE-283, and the one it carried until then bought
 * nothing. This module holds no hook, no bound handler and no browser global: it
 * spreads its props onto `next-themes`, which declares the directive on its own
 * dist. Its only importer is `providers.tsx`, which is already a client module,
 * so the directive here marked a boundary that had been crossed one level up --
 * exactly the argument that removed `dropdown-menu.tsx`'s under CNCORE-276.
 *
 * MEASURED, NOT REASONED. Removing it left the client bundle byte-identical and
 * the per-request RSC payload unmoved, where removing `providers.tsx`'s as well
 * moved both. ADR-0164 owns those figures with their date and their commit, and
 * this file does not restate them, because a figure stated twice drifts in one
 * of them (ADR-0153). The boundary belongs where a SERVER module renders through
 * it, and that is `providers.tsx`.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
