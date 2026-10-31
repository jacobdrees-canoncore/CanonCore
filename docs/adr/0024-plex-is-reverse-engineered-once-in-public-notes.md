# Plex is reverse engineered once, into public notes

CanonCore studies Plex once, across its whole surface, with REA (morluto/rea, npm `rea-agents`): Plex Media Server observed from outside and taken apart, Plex Web, the Plex desktop app and Plex HTPC, and Plex's iOS and tvOS builds, which Extractor acquires (it gains tvOS for this). The findings are public, dated notes in `docs/research/plex/`, one per part of Plex and an index, each giving the Plex version, the date and REA's evidence, and describing behaviour only: no decompiled code and no file of Plex's enters this repository, and the sweep's captures, analysis projects and extracted files are pushed to no branch (ADR 0022). Plex permitted the Owner to do this, publishing included (the Owner, 11 Oct 2026). The sweep is its own spec in Design references and runs beside the current spec, the one exception to one spec at a time (amended 31 Oct 2026, the Owner: the sweep is the first spec in Design references' order, no longer beside it, and its audit, CC-294, blocks Brink's first ticket, CC-207; `docs/agents/dispatching.md`). This is because the ADRs and specs rest on dozens of claims about Plex (19 sentences in the ADRs alone, counted 11 Oct 2026) that were read from its support pages or through search snippets, or ruled undocumented, such as its file hash (ADR 0015), and a sweep can settle them from what Plex actually does. Every ADR sentence the notes contradict goes to the Owner, and a change the Owner accepts is traced (`tracing-a-decision`); the sweep itself changes no ADR. Decided by the Owner on 11 Oct 2026.

## Considered Options

- REA on Jellyfin too: rejected, because Jellyfin is open source and is read from its source, as ADR 0013 already does.
- REA installed as an MCP server for every agent: rejected for `npx` when a ticket needs it, since the need is one sweep and REA ships several releases a week (6.2.0 to 6.4.0 between 9 and 11 Oct 2026).
- Notes in a private repository, as the design references are (ADR 0022): rejected, because the notes carry behaviour in CanonCore's words, not Plex's code or files, and ADRs and specs must be able to cite them.
- Only the questions CanonCore's ADRs and specs already ask: rejected for Plex's whole surface, so behaviour CanonCore has not yet considered is found too.
- Plex's Android app: dropped, as furthest from CanonCore's clients (Apple and web).
- Running Plex's apps on the iPhone and Apple TV: rejected for the builds alone, because the server sees every request the apps make, and the phone stays with the Design references specs' order.

## Consequences

- Plex becomes input to the Apple prototype (CC-39), while Apple's TV app stays its reference (`docs/design/apple-sample-code.md`, amended).
- Observing Plex's API is not a step towards Plex compatibility: ADR 0009's rejection of a competitor's API stands.
- Each research note marks a claim's evidence (observed, disassembled or documented), so a note can own a claim about Plex's behaviour where Plex documents none.
