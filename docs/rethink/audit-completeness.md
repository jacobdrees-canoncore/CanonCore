# Completeness sweep: topics nobody had raised (2026-09-28)

**Real gaps, P1:**
1. **The Apple TV cannot hold the local catalogue.** Its persistent storage is tiny, and caches get purged (the 500 KB figure is from a 2017 archive guide: /verify).
2. **How a new device finds the server:** an invite link, iCloud key-value sync (`NSUbiquitousKeyValueStore`), multi-server.
3. **Old app against new server (version skew):** additive-only changes within a major version, an OpenAPI diff in CI, and a minimum client version.
4. **Progress needs a locator,** not just seconds: EPUB CFI or Readium Locator, and a page. Allow "bookmark" later.
5. **Admin alerts:** a banner plus APNs push to the Admin. Webhooks come later.
13. **Security basics:** SECURITY.md, private vulnerability reporting, and Renovate on weekly batches.
14. **Telemetry:** none; an opt-out update check only.

**Real gaps, P2:**
8. **Rule-based ("smart") Orderings** (CNCORE-344 story 28; Plex smart collections).
9. **Entity-to-Entity relationships:** family, member of, species of (stories 14, 15).

**Real gaps, P3:**
6. Per-account stream limits, a now-streaming view, and a cellular bitrate warning.
7. Friends' privacy, export and deletion.
10. Ratings and favourites.
11. A Plex/Jellyfin history importer, and ListenBrainz in P5. Watch events need a source field now.

**Real gaps, P10:**
12. App Store distribution, with a demo mode.

**Low and later:**
- iPad;
- audiobook sleep timer and speed;
- gapless music and lyrics (LRCLIB);
- Top Shelf and Now Playing;
- a "Recently added" row.

**CNCORE-344:**
- Stories 14, 15, 28 and 49 are not covered.
- Stories 4, 10, 33, 35, 45, 46 and 47 are partly covered.
- Stories 17 to 20 are dropped.

**Owner asks:** partly met.
- The "prototype to choose providers" became desk research. Proposal: a side-by-side comparison in the P4 spec.
- "Easy and friendly" has no gate. Proposal: P3 is done when a friend pairs and plays without help.
- "Impressive" has no showcase before P10.
