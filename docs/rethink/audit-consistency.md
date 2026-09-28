# Consistency audit of grill-decisions.md (2026-09-28)

## Blocking questions (grilled one at a time)

1. **How does project 1 get TMDB, when the Store is project 4 and no provider is a default (56, 58, R1, R2)?**
2. **Is "As broadcast" the fixed hierarchy or an ordering?** Who decides a Show has Stories (32, 43, 56, 29)? This is also Doctor Who shaping the core.
3. **33 ships a per-field ranking that 56 forbids,** and includes a Doctor Who default.
4. **An omnibus file links two ways (43 against 66),** and Version can't back several Items.
5. **Are local files (tags, NFO, ComicInfo) a Provider?** Can a file's StoryArc create orderings (15, 18, 19 against 37, 56)?
6. **Passkeys need a secure context and a domain,** so a LAN or IP install can't use them (47, 58 against host-agnostic).
7. **Do timeline entries bypass Proposals (61 against 37)?**
8. **Wikidata's status (20, 40 against 56):** does cross-provider identity work without it?

## Mechanical cleanup (after the grill, in one consolidated rewrite)

- **Strike superseded bullets:** 31, 35, 4, 7 and 2 against 12b; 8 against 13; 10 "reopens 8"; 13 "AT RISK" against 10a.
- **Principle against 53:** "a plain binary" against a Node bundle.
- **13 against 34 (who curates).**
- **Provider-specific leftovers:**
  - 54's TMDB expiry becomes a manifest cache ceiling;
  - 29 and 34's shared-ordering ids become provider-neutral;
  - 11's "every TMDB show".
- **55 against 60:** where the web app searches.
- **Stale markers:** 9, 12, 21, 26, 28, 52, 69, plus gaps-reconciled's audio track and Fandom image lines.
- **Glossary violations:**
  - link-for-Match (about 25);
  - source-for-Provider (about 5);
  - override, serial, series, work, chronology, user, owner.
- **CONTEXT.md:** avoid "collection" in its own intro. Add Artist, Album, Track, Issue, Offline, Continue Watching and Up Next.
- **Missing reasons:** 70, 2, 5, and the uncited decisions. Numbering is out of order. There is no decision-to-ADR map.

## Unowned markers to assign

- The upload allowance (3).
- The backup destination (52).
- The merge queue and remote cache (72).
- The spec named in 67.
- The @reboot check.
- The Whatbox and Big Finish grant texts.
