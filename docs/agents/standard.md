<!-- The one copy of the standard every CanonCore repository imports. Edit it only in
jacobdrees-canoncore/CanonCore; every other repository's CI compares its copy with main. -->

## Most Important: Verify, don't recall

Look up any version, API signature, limit or price before stating it (`context7` for a library,
`WebSearch` otherwise); the lookup wins over memory. The point is current industry practice: what
the ecosystem does today, not what it did when the model was trained. Before a spec or its tickets
publish, check what competitors do and run `/verify` on every claim a decision rests on.

## Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.
- Do not introduce a configuration option, feature flag, or environment variable unless something in the repo reads it in the same change.
- Do not add a dependency without stating in the PR body what you checked in the existing dependencies first.
- Report status with evidence. "Tests pass" requires the command and its output. If a check was skipped, or failed, say so plainly rather than describing the work as complete.
- Prefer deletion. A change that removes more lines than it adds needs no justification; one that adds more needs a reason in the PR body.
- Keep this file a pointer file, under 200 lines. Repeated gotchas become checks (lint, hooks, CI), not prose here.
