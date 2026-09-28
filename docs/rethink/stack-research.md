# Stack research: competitors and candidates (2026-09-28)

Checked with `verify`: 7 contradicted, 8 unfounded, about 60 confirmed. The picks are judgement.

## Competitors (confirmed at their repos)

| Project | Server | Database | API contract | Web | Auth and pairing | Apple client |
|---|---|---|---|---|---|---|
| Jellyfin 12.1 | C# ASP.NET Core, .NET 10 | EF Core + SQLite | Swashbuckle (code-first); TS SDK via openapi-generator; Swift SDK via LePips/openapi-generator | React 18 + webpack (partly legacy) | Own; QuickConnect code + polled secret | Swiftfin 1.6.1 (iOS, tvOS; VLC player; no Mac) |
| Emby 4.10 | .NET (closed) | SQLite x4 | Swagger + SDKs | U | Emby Connect | own |
| Plex | U | U | Official OpenAPI (PMS 1.43.4+) | U | 7-day device JWTs since Oct 2025; PIN at plex.tv/link | React Native (new apps) |
| Audiobookshelf 2.36 | Node + Express 4 + TS | Sequelize + SQLite | Hand-written OpenAPI YAML | Nuxt 2 | JWT 1h + 30d refresh, OIDC, API keys | Capacitor (beta) |
| Navidrome 0.64 | Go + chi | SQLite (dbx, squirrel, goose) | Subsonic + native + Jellyfin-compatible; spec-first apiv1 (oapi-codegen) on main | React 17 + react-admin + Vite | 6-digit Quick Connect | Subsonic clients |
| Kavita 0.9.1 | .NET 10 | EF Core + SQLite | Swashbuckle | Angular 22 | JWT + refresh, API key, OIDC | Panels (OPDS) |
| Komga 1.27 | Kotlin Spring Boot 3.5 | jOOQ + Flyway + SQLite | springdoc; web client via @hey-api/openapi-ts | Vue 3 + Vite 8 | Session / X-Auth-Token, API keys | Panels, Komic, KMReader (tvOS) |
| Stremio | Rust wrapping closed server.js | cloud | none | React 18 + WASM core | Cloud accounts; link.stremio.com | own |
| Immich 3.2 | NestJS 12 | Postgres + Kysely 0.29 | @nestjs/swagger, spec committed; oazapfts TS SDK | SvelteKit 2 + Svelte 5 + Vite 8 + Tailwind 4 | Sessions, API keys, OAuth | Flutter |

**Pattern:** every open competitor with its own API generates the spec from code, and none uses an auth library.

## Contradicted

- **TanStack Start** is still a Release Candidate.
- **Zod 4** has no `openapi-3.1` target. Its default, draft-2020-12, already fits OpenAPI 3.1.
- **Vidstack:** npm latest is 0.6.15 and it is merging into Video.js v10 (rc.4).
- **Drizzle** is 0.45.3 and has `node:sqlite` only in 1.0.0-rc.4.
- **Better Auth** was acquired by Vercel on 2026-07-07. Its API-key plugin is now a separate package.
- **Jellyfin's Swift SDK** README is stale about its generator.

## Key facts

- **HTTP frameworks:** hono 4.13.10 with @hono/node-server 2.1.1; fastify 5.12.5.
  - @hono/zod-openapi 1.6.3 needs Zod 4.
  - Range requests return 206 on both.
- **`node:sqlite`** is a release candidate (1.2) since Node 24.15.
- **better-sqlite3 13** uses N-API and ships prebuilt binaries.
- **Kysely 0.29.6** has migrations but no `node:sqlite` dialect.
- **Better Auth 1.7.6:**
  - `device-authorization` (RFC 8628), `bearer` and `multi-session` plugins.
  - No profiles feature.
- **Lucia** was deprecated in March 2025.
- **Next 16 static export** cannot produce runtime-id routes.
- **hls.js 1.7.3** (2026-09-11) and **Media Chrome 4.19.2** (Mux) are both current.
- **swift-openapi-generator 1.13.1:**
  - The runtime supports tvOS 13+.
  - Streaming needs iOS or tvOS 15+.
  - SSE and JSON Lines are supported.

## Recommended stack (J)

| Layer | Pick | Runner-up | Precedent |
|---|---|---|---|
| HTTP | Hono 4 + @hono/node-server | Fastify 5 | none among competitors |
| Spec | @hono/zod-openapi, code-first, OpenAPI 3.1 | hono-openapi | Jellyfin, Immich, Kavita, Komga (code-first) |
| Validation | Zod 4 | Valibot 1 | none |
| SQLite | better-sqlite3 13 | `node:sqlite` once Stable | almost all |
| Queries and migrations | Kysely + Migrator | Drizzle 1.0 once released | Immich |
| Auth | Better Auth (device, bearer, api-key), with profiles in our own tables | hand-rolled | Jellyfin and Immich hand-roll |
| Swift client | swift-openapi-generator 1.13 | hand-written | Jellyfin generates |
| TS types | Zod types imported directly (U) | @hey-api/openapi-ts | Komga |
| Web | React 19 + Vite 8 + TanStack Router SPA | TanStack Start SPA mode (RC) | Navidrome, Jellyfin |
| Player | hls.js 1.7 + Media Chrome 4 | Video.js v10 once released | U |
