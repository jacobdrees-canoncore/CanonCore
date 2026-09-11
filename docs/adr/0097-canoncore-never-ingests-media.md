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
