"use client";
import Link from "next/link";

import { OUR_MARK_PX } from "./marks";
import { ModeToggle } from "./mode-toggle";
import { SearchBox } from "./search-box";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex items-baseline gap-4 text-lg">
          {/*
            CANONCORE'S OWN WORDMARK, and it is here to be a mark rather than a
            decoration. TMDB's terms require their logo be "less prominent than
            the logos or marks that primarily describe or identify Your
            Application" -- and until this line there was no such mark anywhere in
            the app, so the comparison had nothing to be less prominent THAN.

            The size is an inline style from `marks.ts` rather than a utility
            class, so the relationship it is half of is in the served HTML where a
            test can read it back. See that file for the other half.
          */}
          <Link href="/" className="font-semibold" style={{ fontSize: `${OUR_MARK_PX}px` }}>
            CanonCore
          </Link>
          {/*
            THE TWO QUESTIONS ADR-0077 NAMES, side by side, which is what makes
            them two surfaces a reader chooses between rather than one page with
            a filter somewhere on it. `/` answers "what is in this catalogue"
            and `/works` answers "what can I watch"; a work-browsing surface
            reachable only by typing its address answers neither.

            IT IS IN THE HEADER rather than on the catalogue page alone, because
            the return journey matters as much: a reader who has narrowed to
            Works needs the way back to everything, and ADR-0077's own words for
            an entity container are that it is "reached deliberately" -- which
            requires somewhere to reach it from.

            `Link` RATHER THAN `a` (ADR-0109), as everything else that emits a
            URL here does.
          */}
          <Link href="/works" className="text-base hover:underline">
            Works
          </Link>
          {/*
            AND THE SURFACE A CATALOGUE IS FILLED FROM, for the same reason the
            two reading surfaces are here: an import page reachable only by
            typing its address is one an owner has to be told about. It is in the
            header rather than on the empty catalogue alone, because an owner who
            already has items is just as likely to want another.
          */}
          <Link className="text-base hover:underline" href="/import">
            Import
          </Link>
          {/*
            AND THE SURFACE A CATALOGUE IS FILLED FROM BY HAND (CNCORE-71),
            beside the one it is filled from by a provider. ADR-0003's item with
            no file and no provider record is the case no incumbent serves, and
            a page reachable only by typing its address serves it to nobody.

            OFFERED TO EVERYONE, like Import above it, because this header knows
            nothing about sessions -- it is a client component and the session
            is a server-side cookie. The PAGE is what tells a visitor the
            catalogue is not theirs to add to, which is the same division
            `/import` already uses: the surface renders, its buttons do not.

            TODO(CNCORE-139): AND THAT DIVISION IS NO LONGER UNCONTESTED. Since
            CNCORE-133 an empty catalogue offers these two routes only to the
            owner, because both end in a refusal for anybody else -- so this
            header is now the one surface that still hands them to every reader.
            ADR-0094 argues the two are different in kind (a nav link is a map
            of what the product HAS; an empty state is ADVICE it volunteers) and
            that ticket is where the argument is either taken or replaced.
            Untouched here on purpose: reading a session from a client component
            is a different change from the one that ticket reviewed.
          */}
          <Link className="text-base hover:underline" href="/new">
            New item
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {/*
            IN THE SHELL, so Catalogue search is reachable from wherever a
            reader already is rather than only from the front page. See
            `search-box.tsx` for why it is a `Form` and not a `form`.
          */}
          <SearchBox />
          <ModeToggle />
        </div>
      </div>
      <hr />
    </div>
  );
}
