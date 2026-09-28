# DevAtlas read for the stack (2026-09-28)

devatlas.site is a hand-picked directory of 169 backend tools across 12 regions, with three curated stacks. It was read through its own `llms.txt`.

## What it offers this rebuild (J)

**A shortlist, not a verdict.** Its entries are a line each, aimed at hosted SaaS.
- **Self-hosted stack:** Coolify, Ory, PostgreSQL, Valkey, MinIO, Novu, Grafana, Uptime Kuma. That is a multi-service VPS, which contradicts decision 7 (one Node process and a SQLite file on a shared Whatbox, no containers). Not adopted.
- **Node frameworks listed:** Express, Fastify, NestJS, Hono, Koa, Elysia (Bun), tRPC.
- **Data:** Drizzle and Prisma (ORMs), Turso (libSQL). SQLite itself is not listed.
- **Auth:** Better Auth, Lucia, Auth.js, Ory, FusionAuth.
- **API:** Swagger, OpenAPI Generator, Stoplight.
- **Testing:** Vitest, Playwright.

## What it does not cover

Media servers, ffmpeg/HLS, Apple clients, maps and metadata providers. Those come from the research in this folder.

Each candidate is checked with `verify` before it is marked Recommended in the grill.
