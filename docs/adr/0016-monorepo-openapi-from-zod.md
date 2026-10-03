# A pnpm and Turborepo monorepo, with the API contract generated from Zod

The server is Node 26 (LTS from 28 Oct 2026, supported to 30 Apr 2029; corrected from Node 24 on 2026-09-30, since no server code exists before 26 is LTS) with Hono 4, its routes declared with Zod 4 schemas through @hono/zod-openapi so the OpenAPI 3.1 spec is generated from code (as in Jellyfin, Immich, Kavita and Komga), and that spec feeds swift-openapi-generator for the Apple app and the TypeScript types for the web, so one typed contract serves every client. The server, the web app and the Apple app live in one pnpm and Turborepo monorepo, and CI runs only what a change affects, through `turbo run … --affected`: a docs-only change runs docs checks, Playwright runs only when web code is affected and Xcode only when Apple code is, with a nightly job running everything. This is because the CI pipeline was the bottleneck of the last attempt, where a docs change ran the whole pipeline.

## Considered Options

- Fastify: the runner-up to Hono.
- Next.js for the web: passed over because static export cannot serve runtime routes; the web is a React 19, Vite and TanStack Router single-page app served by the same Node process.

## Consequences

- `--affected` needs full git history; a shallow clone falls back to running everything.
- A merge requires CI to have passed on the exact commit that lands. Enforced, not convention, from 3 Oct 2026: `main`'s ruleset requires CI's checks, and Main merges with `gh pr merge --auto` (CC-163).
