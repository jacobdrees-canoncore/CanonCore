---
status: proposed
---

# The web client uses Arc as it ships

CanonCore's web client and the web prototype (CC-38) use Arc (uiarc.dev: its free MIT part and Arc Pro) exactly as Arc ships it. Arc is installed through the shadcn CLI beside Tailwind CSS v4; its components are CSS modules on Arc's own tokens, animated with Motion; `foundation.css` is imported once at the root and never patched. This supersedes ADR 0021's styling stack. Its status is proposed only because nothing of Arc is installed yet; it becomes accepted when the web client's first ticket installs Arc. The decision itself is the Owner's, and it replaces ADR 0021 now: no agent builds on 0021's stack in the meantime. This is because Arc's components "use CSS modules and CSS variables, not Tailwind classes, so they install cleanly next to Tailwind or without it" (uiarc.dev/guides/shadcn-registry-ai-coding-tools), and its agent rules say to "compose and wrap Arc components; never fork or restyle their internals", so taking Arc whole keeps every component, token and rule in one place an agent can read. Decided by the Owner on 1 Oct 2026; the research is `docs/design/arc-integration.md`.

## What follows from using Arc whole

- **No focus rings.** There are no focus rings or outlines for any input method, as Arc's foundation sets (`:is(*:focus, *:focus-visible, *:focus-within) { outline: none !important; }`, with `--focus-ring: transparent`). Arc's rules say to show keyboard position with its hover and selected fills.
- **Accessibility claims.** axe keeps running the WCAG 2.2 AA rules on every web merge; axe-core (4.13.0) has no rule for WCAG 2.4.7 Focus Visible, a Level AA criterion in WCAG 2.2, so it does not see the missing rings. CanonCore claims no WCAG 2.2 AA conformance, and the keyboard-only pass in a spec's audit does not report missing focus rings. Whether Arc's fills count as a visible focus indicator is left open.
- **Arc's tokens win.** Where Arc's `:root` variables share a name with shadcn's (`--background`, `--foreground`, `--border`, `--accent`, `--accent-foreground`), Arc's values win.
- **Dark mode** keys on `data-theme="dark"` on `<html>`, not shadcn's `.dark` class. Following the system setting is the app's job: Arc's foundation has no `prefers-color-scheme` rule.
- **Radix is the one primitive library.** shadcn is initialised on Radix, not its default Base UI (`--base radix`; shadcn 4.21.1's default `base-nova` is Base UI). Arc uses Radix in 17 of its 123 free items (verified 2 Oct 2026; the registry grows, and read 19 of 128 later that day) and never Base UI.
- **Arc's agent rules apply** to the web client and the web prototype: Geist and Inter only, weights 400 and 500 (the prototype's untitled look excepted, below), and no decorative gradients or glows. They are recorded as revisitable. Which gradients count as decorative is decided case by case in the web prototype (the cover-to-black tint of CC-33, the frosted folder front and its Liquid Glass web twin of CC-37 and CC-52, CC-66's mesh-gradient cards, the replica's blur fades), and its verdict records which stay.
- **DESIGN.md stays** as a mirror of Arc's tokens, for agents and the Apple app. `@shadcn/lint` is dropped: it reads a Tailwind `@theme`, and Arc's tokens are plain CSS variables.
- **The look waits on a Look switch.** Where untitled's look and Arc's look disagree, which leads is tried as a Look switch in the web prototype (CC-38): it is carried in the URL beside the variant switcher, and in Storybook's toolbar. ADR 0020's "untitled leads" waits on that verdict. The prototype uses Arc free and Pro.
- **untitled's fonts stay in the prototype.** The web prototype's untitled look always uses untitled's fonts (Untitled Sans and IBM Plex Mono) inside the private prototype only (the Owner, 6 Oct 2026). CanonCore itself stays on Geist and Inter.

## Scope

Arc's rules bind CanonCore's web client and the web prototype. The Apple app's answer comes from the Apple prototype (CC-39), which tries both. The private design repositories (untitled's replica, the folder component) and agents' throwaway reports are not bound. ObsidianUI and uselayouts are dropped entirely: not installed, evaluated or studied.

## Arc Pro in a public repository

Arc Pro files may ship in CanonCore's public repository. CanonCore stays AGPL-3.0, with an additional permission under AGPL section 7 covering the Arc Pro files (ADR 0018); those files keep the Arc Pro notice and are named in the README. Arc Pro's licence (uiarc.dev/license, a draft dated 26 Sep 2026) allows Pro source "in an open-source end product, such as an app you publish on GitHub, as long as the Pro source is only a part of it and your project is not a UI kit, library or template", with the notice kept and the files marked as outside the project's licence. It forbids redistributing Pro source on its own, and one purchase is one seat: every person who works directly with Pro source needs their own. Arc Pro costs $199 lifetime ("today's price") or $129 a year (uiarc.dev/pricing, verified 2 Oct 2026).

## Agents

- Agents use Arc's MCP server, its `arc` skill and its `INSTRUCTIONS.md`.
- The `arc` skill installs in CanonCore's repository at project scope (`.claude/skills/arc/`), never in `~/.claude/skills`, which is the skills repository's checkout.
- The Arc Pro token lives in `~/.config/canoncore/arc-pro.env`, never in a repository. Installing a Pro component exports it for that one shadcn command.
- Every web-client agent gets Arc Pro through Arc's MCP server: lean launches add `--mcp-config ~/.config/canoncore/arc-mcp.json` (Arc's server with the Pro token, outside every repository). Main has the server at user scope, as Arc's docs say.

## Considered Options

- Tailwind 4, shadcn on Base UI, DESIGN.md exported to `@theme` and checked by `@shadcn/lint` (ADR 0021): superseded, because Arc defines its own tokens on `:root`, never mentions Base UI, and publishes no `@theme` mapping.
- Arc restyled onto shadcn's tokens, or `foundation.css` patched to keep focus rings: rejected, because Arc's rules forbid restyling its internals, and a patched foundation drifts from every update Arc ships.
- ObsidianUI and uselayouts beside Arc: rejected, so the web client has one component source.

## Consequences

- Nothing of Arc is installed by this record. The web client's first ticket installs it, creates the token files and adds the MCP server.
- Each contributor who touches an Arc Pro file needs their own seat, and their code is covered by the section 7 permission only with their agreement (ADR 0018).
- The shadcn CLI's default must be overridden at init, since Radix is no longer its default base.
