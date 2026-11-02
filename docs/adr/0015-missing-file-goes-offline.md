# A media file not found at a scan goes Offline, and is recognised again by fingerprint

Each media file is recognised by a content fingerprint, its size plus hashes of a few chunks, so a rename or move keeps its Match, Edition and Progress (as in old ADR-0023 (canoncore-history)), and a file not found at a scan becomes Offline, never deleted, and returns when the file does. This is because Jellyfin deletes rows during a storage blip (old where-it-runs.md (canoncore-history) §6.6), so removal is only ever deliberate, and scans run on a schedule and on demand since file-change events are unreliable on network disks (old ADR-0050 (canoncore-history)). The fingerprint is CanonCore's own design: Plex documents that each file carries a hash but not its algorithm (the size plus the first and last 64 KiB, per `docs/research/plex/server-inside.md`, section 1), and Emby documents none (reworded by the Owner, 2 Nov 2026).

## Considered Options

- Identity by path, deleting what disappears, as Jellyfin does: rejected, a storage blip then loses Matches and Progress.
