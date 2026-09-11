/**
 * Design tokens as a plain TypeScript object.
 *
 * ADR-0052 requires this form: a TypeScript object is readable by every
 * consumer without a build step or a framework, where a stylesheet is readable
 * by a CSS engine and a Tailwind config is readable by Tailwind. A future
 * client that is not a web page reads these same values.
 *
 * This file is the source of truth. `packages/ui/src/styles/globals.css`
 * declares the same values as CSS custom properties because a stylesheet
 * cannot import TypeScript, and `globals.css.test.ts` fails if the two drift.
 */

/** A colour with one value per theme. */
export interface ThemedColour {
  readonly light: string;
  readonly dark: string;
}

export const colour = {
  background: { light: "oklch(1 0 0)", dark: "oklch(0.145 0 0)" },
  foreground: { light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" },
  card: { light: "oklch(1 0 0)", dark: "oklch(0.205 0 0)" },
  cardForeground: { light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" },
  popover: { light: "oklch(1 0 0)", dark: "oklch(0.205 0 0)" },
  popoverForeground: { light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" },
  primary: { light: "oklch(0.205 0 0)", dark: "oklch(0.87 0 0)" },
  primaryForeground: { light: "oklch(0.985 0 0)", dark: "oklch(0.205 0 0)" },
  secondary: { light: "oklch(0.97 0 0)", dark: "oklch(0.269 0 0)" },
  secondaryForeground: { light: "oklch(0.205 0 0)", dark: "oklch(0.985 0 0)" },
  muted: { light: "oklch(0.97 0 0)", dark: "oklch(0.269 0 0)" },
  mutedForeground: { light: "oklch(0.556 0 0)", dark: "oklch(0.708 0 0)" },
  accent: { light: "oklch(0.97 0 0)", dark: "oklch(0.371 0 0)" },
  accentForeground: { light: "oklch(0.205 0 0)", dark: "oklch(0.985 0 0)" },
  destructive: { light: "oklch(0.58 0.22 27)", dark: "oklch(0.704 0.191 22.216)" },
  border: { light: "oklch(0.922 0 0)", dark: "oklch(1 0 0 / 10%)" },
  input: { light: "oklch(0.922 0 0)", dark: "oklch(1 0 0 / 15%)" },
  ring: { light: "oklch(0.708 0 0)", dark: "oklch(0.556 0 0)" },
  chart1: { light: "oklch(0.809 0.105 251.813)", dark: "oklch(0.809 0.105 251.813)" },
  chart2: { light: "oklch(0.623 0.214 259.815)", dark: "oklch(0.623 0.214 259.815)" },
  chart3: { light: "oklch(0.546 0.245 262.881)", dark: "oklch(0.546 0.245 262.881)" },
  chart4: { light: "oklch(0.488 0.243 264.376)", dark: "oklch(0.488 0.243 264.376)" },
  chart5: { light: "oklch(0.424 0.199 265.638)", dark: "oklch(0.424 0.199 265.638)" },
  sidebar: { light: "oklch(0.985 0 0)", dark: "oklch(0.205 0 0)" },
  sidebarForeground: { light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" },
  sidebarPrimary: { light: "oklch(0.205 0 0)", dark: "oklch(0.488 0.243 264.376)" },
  sidebarPrimaryForeground: { light: "oklch(0.985 0 0)", dark: "oklch(0.985 0 0)" },
  sidebarAccent: { light: "oklch(0.97 0 0)", dark: "oklch(0.269 0 0)" },
  sidebarAccentForeground: { light: "oklch(0.205 0 0)", dark: "oklch(0.985 0 0)" },
  sidebarBorder: { light: "oklch(0.922 0 0)", dark: "oklch(1 0 0 / 10%)" },
  sidebarRing: { light: "oklch(0.708 0 0)", dark: "oklch(0.556 0 0)" },
} as const satisfies Record<string, ThemedColour>;

/** The base corner radius. Tailwind derives its scale from this one value. */
export const radius = "0.625rem";

export type ColourName = keyof typeof colour;
