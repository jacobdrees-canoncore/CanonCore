# The web client is styled with Tailwind 4, the shadcn registry and Motion

The web client (React 19, Vite and TanStack Router, ADR 0016) uses Tailwind CSS v4 for styling, the shadcn registry for components, which are copied in as source the repo owns, and Motion for React for animation. shadcn is initialised on its default base, Base UI (the default since July 2026), chosen by the Owner on 2026-09-30 over Radix, although the site the design foundation's replica measures (ADR 0020) uses Radix for its dialog, dropdown menu and switch: that behaviour is re-created on Base UI rather than carried over. The design tokens live in a DESIGN.md (Google's format: YAML tokens plus prose rationale), and reach `@shadcn/lint` through DESIGN.md's Tailwind export (`export --format css-tailwind`), which writes them into the Tailwind v4 `@theme` the lint rules read.

## Considered Options

- shadcn on the Radix base, matching untitled.stream's own primitives: rejected by the Owner in favour of shadcn's current default.
- Tailwind and Motion without the registry: rejected, because the component libraries picked from the bookmarks could then only be copied by hand.
- Deciding inside the prototype: rejected, because the prototype's web variants need one stack to vary within, and a styling system touches every component later.

## Consequences

- The replica (React 19, Vite 8, Tailwind 4) and the folder component (Tailwind 4 and Motion 12) port without changing styling or animation engine: the folder's Astro markup and imperative Motion calls are rewritten as React components on Motion for React, and the replica's React Router routes as TanStack Router routes.
- `@shadcn/lint` "works with Tailwind v4 projects (shadcn/ui not required)" and gives coding agents rules they can verify; DESIGN.md's own `lint` checks the file itself.
- Arc, ObsidianUI and uselayouts install through the shadcn CLI, so they arrive as registry source rather than as runtime dependencies.
- On npm on 2026-09-30: tailwindcss 4.3.3, motion 13.4.6 (MIT), shadcn 4.21.0 and @shadcn/lint 0.2.0.
