---
status: proposed
---

# CanonCore never ingests media, and playback goes through an opaque-id route

CanonCore is a media server in its own right, not a client of Plex or Jellyfin. It never INGESTS
media: a file row REFERENCES bytes that stay where the owner put them.

Playback goes through an app-owned opaque-id route rather than a path or a public URL, so access
control and progress work. That is the one constraint on the playback path, and it is why
ADR-0023 can make the path location rather than identity without losing the
ability to serve the file.

The word `source` is NOT available for any of this. It names who asserted a value — a provider, the
owner, a sidecar or a computation (ADR-0071) — and has nothing to do with where
bytes live.

CanonCore is also domain-general. It is self-hosted software plus ONE public read-only demo instance
(`docs/demo.md`); everything else is software someone else runs.

## As built — and this record stays PROPOSED

Three claims, in three different states, which is why this section exists at all: read straight
through, the record reads as one settled thing.

**BUILT: never ingesting, and the `source` reservation.** The first holds by ABSENCE — no
migration creates a `files` table, so nothing references bytes yet and nothing could ingest them if
it tried. The second is real and is the only part of this record that any code leans on: `sources`
names who asserted a value throughout the schema (ADR-0071's four kinds), and nothing uses the word
for where bytes live. Its one citer is `provider-wiki`'s CMPP module, in another repository.

**NOT BUILT: the opaque-id playback route, and the file row it would serve.** There is no playback
route of any kind, app-owned or otherwise, and no file row for one to resolve. So "access control
and progress work" states a constraint on a path that does not exist — recorded before the path, in
the right order, but not a description of how anything behaves today. ADR-0023's path-is-location
holds either way, since nothing serves a file at all.

**AND THE DEMO SENTENCE IS ABOUT A PUBLIC INSTANCE, NOT A MECHANISM.** `docs/demo.md` describes one
by hand; ADR-0089 records that no PUBLIC image exists.
