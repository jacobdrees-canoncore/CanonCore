import { appRouter } from "@canoncore/api/routers";
import { call } from "@orpc/server";
import Link from "next/link";

import { callerContext } from "@/session";
import { OUR_MARK_PX } from "./marks";
import { ModeToggle } from "./mode-toggle";
import { SearchBox } from "./search-box";

/**
 * THE SHELL EVERY PAGE IS SERVED INSIDE.
 *
 * A SERVER COMPONENT SINCE CNCORE-139, and the `"use client"` it carried until
 * then bought nothing. Nothing in this file has state, an effect or a handler:
 * `ModeToggle` declares the directive for itself and the search box is a
 * `next/form`, which a server component renders perfectly well. What the
 * directive did cost was a header that could not read a session, and that was
 * the whole of the defect this file used to carry a TODO about.
 */
export default async function Header() {
  /*
   * WHO IS ASKING, WHICH DECIDES WHAT THIS OFFERS THEM (CNCORE-139, ADR-0094).
   *
   * `callerContext` RATHER THAN THE ROUTER, because the only fact wanted here
   * is the one the context already holds: a session, or none. A procedure call
   * would be a round trip to ask what the request arrived with.
   *
   * READ IN THE SHELL, so it is read on EVERY page rather than on the one that
   * happens to care. That is what makes the whole app render per request --
   * measured on 16.3.4, `/_not-found` is the one route that stops being
   * prerendered by it -- and ADR-0117 carries what that does and does not
   * change about the rule it states.
   */
  const context = await callerContext();
  const owner = context.session !== null;
  /*
   * AND WHETHER THERE IS A LOGIN TO OFFER AT ALL, which is a fact about the
   * INSTANCE rather than about the reader (ADR-0044, CNCORE-133). An instance
   * that sets no `OWNER_PASSWORD` refuses every password, so nobody obtains a
   * session including the owner -- and a login link there would be the door
   * with no key cut for it that `/login` itself refuses to render.
   *
   * `session.configured` READS THE SETTING AND NOTHING ELSE, so the answer
   * costs no query; it is the procedure the empty state already asks the same
   * question with, one setting over from `provider.allowlisted`.
   */
  const instance = await call(appRouter.session.configured, undefined, { context });

  return (
    <header>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        {/*
          LABELLED, BECAUSE A PAGE HERE CARRIES MORE THAN ONE NAV. An item page
          has "Filter by how it was placed" and any walked listing has "More of
          this listing", so the landmark every page carries was the one a reader
          navigating by landmark could not name. The label is what an assertion
          reads this by too, rather than a class or a position.
        */}
        <nav aria-label="Main" className="flex items-baseline gap-4 text-lg">
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

            OFFERED TO EVERY READER, because reading is (ADR-0044). Both surfaces
            below it are not, which is the distinction this nav draws since
            CNCORE-139 and did not draw before.
          */}
          <Link href="/works" className="text-base hover:underline">
            Works
          </Link>
          {owner && (
            <>
              {/*
                AND THE TWO SURFACES A CATALOGUE IS FILLED FROM, for the same
                reason the reading surfaces are here: a page reachable only by
                typing its address is one an owner has to be told about.
                `/import` is filled from a provider and `/new` by hand --
                ADR-0003's item with no file and no provider record, the case no
                incumbent serves. They are in the header rather than on the
                empty catalogue alone, because an owner who already has items is
                just as likely to want another.

                OFFERED TO THE OWNER AND TO NOBODY ELSE (CNCORE-139), where this
                nav used to offer them to every reader of every page. Both end
                at a surface behind a session: `/new` answers a visitor "Only
                the owner of this catalogue can add to it" and `/import` renders
                with every button disabled -- so a nav that listed them to a
                visitor put every reader in the product one click from a
                refusal. ADR-0094 held that a nav link was exempt because it is
                a map of what the product HAS rather than advice it volunteers;
                that argument is replaced in the record itself, and the shortest
                of its reasons is that this nav never was such a map --
                `/settings`, `/tasks` and `/devices` are the owner's too and
                have never been in it.
              */}
              <Link className="text-base hover:underline" href="/import">
                Import
              </Link>
              <Link className="text-base hover:underline" href="/new">
                New item
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {/*
            IN THE SHELL, so Catalogue search is reachable from wherever a
            reader already is rather than only from the front page. See
            `search-box.tsx` for why it is a `Form` and not a `form`.
          */}
          <SearchBox />
          <ModeToggle />
          {/*
            AND THE ONE STEP A READER WITHOUT A SESSION CAN TAKE (CNCORE-139).
            It is the other half of thinning the nav above: a header that
            stopped offering the owner's routes and offered nothing in their
            place would leave the owner of an instance with items in it no
            rendered way to `/login` at all -- the empty state that offers one
            is retired by the first Item, and the README's first instruction is
            to go and log in.

            AT THE END OF THE ROW RATHER THAN IN THE NAV, which is where every
            comparable product puts it. The nav is destinations in the
            catalogue; this is the account, beside the other controls that are
            about the reader rather than about the collection.

            NOT SHOWN TO THE OWNER, who has already taken it. `/login` renders
            a Log out form for them instead, and a header link labelled `Log
            in` that logged you out would be the sort of lie this whole ticket
            is about.
          */}
          {!owner && instance.password && (
            <Link className="text-sm hover:underline" href="/login">
              Log in
            </Link>
          )}
        </div>
      </div>
      <hr />
    </header>
  );
}
