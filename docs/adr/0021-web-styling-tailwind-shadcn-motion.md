# The web client is styled with Tailwind 4, the shadcn registry and Motion

The web client (React 19, Vite and TanStack Router, ADR 0016) uses Tailwind CSS v4 for styling, the shadcn registry for components, which are copied in as source the repo owns, and Motion for React for animation. The design tokens live in a DESIGN.md (Google's format: YAML tokens plus prose rationale), and `@shadcn/lint` enforces them, since it "works with Tailwind v4 projects (shadcn/ui not required)" and gives coding agents rules they can verify. This is because the design foundation's replica (ADR 0020) is React 19, Vite 8 and Tailwind 4, the site it measures uses Radix-style primitives (dialog, dropdown menu, switch), which is what shadcn's components are built on, and the folder component is Tailwind 4 plus Motion, so both port without translation. Arc, ObsidianUI and uselayouts all install through the shadcn CLI or Motion, so they arrive as registry source rather than as runtime dependencies. On npm on 2026-09-30: tailwindcss 4.3.3, motion 13.4.6 (MIT), shadcn 4.21.0 and @shadcn/lint 0.2.0.

## Considered Options

- Tailwind and Motion without the registry: rejected, because the component libraries picked from the bookmarks could then only be copied by hand.
- Deciding inside the prototype: rejected, because the prototype's web variants need one stack to vary within, and a styling system touches every component later.
