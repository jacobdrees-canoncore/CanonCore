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
