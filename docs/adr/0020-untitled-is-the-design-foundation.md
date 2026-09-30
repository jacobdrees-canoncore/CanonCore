# untitled.stream is the design foundation; the folder is its signature component

CanonCore's design starts from untitled.stream: its look and its structure (shell, library, project and track pages, player, settings, sign-in, every route) lead, as measured by the standalone web replica in `~/canoncore/untitled-replica`, which is finished across every route before the design prototype starts. The frosted-folder portfolio (github.com/fayazara/portfolio-site-template) contributes one signature component: a grouping whose contents peek through frosted glass and open into a gallery on named springs, such as opening at 0.55 s with bounce 0.35. The web ports the folder's code into React with Motion. The Apple app rebuilds it with SwiftUI's `spring(duration:bounce:)`, keeping the numbers, since both engines describe a spring by duration and bounce. A folder is a presentation, not a domain concept: any grouping (a Franchise, Collection, Show or Ordering) may be shown as one. This is because untitled is the closest shipped product to CanonCore's own screens (a dark library of artwork, album-like pages, a player), while the portfolio has no player, dense lists, Item pages or Apple TV.

## Considered Options

- The portfolio as the whole design language, with untitled filling only the screens it lacks: chosen first on 2026-09-30, then reversed the same day by the Owner.
- Both as equal foundations, split by job: rejected, because two leads leave every conflict between them open.

## Consequences

- CanonCore is adapted from untitled, never a copy of it. untitled's terms forbid derivative works and the Owner's permission is verbal, so anything drawn by untitled (artwork, icons) and its licensed fonts (Klim's Untitled Sans) stay out, and the brand at public release (CC-8) gives CanonCore its own type, colour and mark.
- Copying the folder's code into the public repo waits on a licence in its source (ADR 0019).
- On Apple TV the focus system moves the eye, not a pointer, so the folder must be proved with a remote before any screen depends on it.
