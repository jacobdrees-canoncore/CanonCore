# The code is AGPL-3.0

The code is AGPL-3.0, so anyone who runs a modified CanonCore for other people must offer those users the Corresponding Source of their version (AGPL-3.0 section 13). Nobody can turn it into a closed hosted service. Provider data is used under each Provider's own terms, most of them non-commercial, which the README states and the app shows as attribution (Settings › About, plus TMDB's logo and notice). Where a Provider's terms ask for credit on every page that uses its data, each such page links back to the source, built from the Source every value already carries. Arc Pro files ship under an additional permission, below.

## Arc Pro files (ADR 0023, 2 Oct 2026)

Arc Pro files may ship in the public repository under an additional permission granted by AGPL-3.0 section 7, which lets a copyright holder add permissions that recipients may also remove. The README names the files it covers, and each keeps its Arc Pro notice. The permission's text starts from the GNU FAQ's sample (gnu.org/licenses/gpl-faq.html#GPLIncompatibleLibs), adapted to the AGPL:

> Additional permission under GNU AGPL version 3 section 7
>
> If you modify this Program, or any covered work, by linking or combining it with [name of library] (or a modified version of that library), containing parts covered by the terms of [name of library's license], the licensors of this Program grant you additional permission to convey the resulting work. {Corresponding Source for a non-source form of such a combination shall include the source code for the parts of [name of library] used as well as that of the covered work.}

The FAQ says to drop the braced sentence "if not everybody can distribute source for the libraries"; Arc Pro's licence forbids sharing Pro source on its own, so whether it stays is settled when the first Pro file lands. Only copyright holders can grant the permission, so it covers each contributor's code only with that contributor's agreement.

## Considered Options

- MIT: rejected, because it would allow a closed, hosted fork.
- GPL-3.0 (Audiobookshelf, Navidrome) or GPL-2.0 (Jellyfin): rejected, because their copyleft does not reach a server that is only run over a network, not distributed. Immich uses AGPL-3.0 (licences verified with the GitHub API, 2026-09-28).
