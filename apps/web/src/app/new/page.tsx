import { appRouter } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import { Input } from "@canoncore/ui/components/input";
import { Label } from "@canoncore/ui/components/label";
import { call } from "@orpc/server";
import type { Metadata } from "next";
import Link from "next/link";

import { callerContext } from "@/session";

import { createItem } from "../items/actions";

export const metadata: Metadata = { title: "New item" };

/**
 * MAKING AN ITEM THE CATALOGUE HOLDS AND NO PROVIDER KNOWS ABOUT (ADR-0003).
 *
 * `/new` RATHER THAN `/items/new`, AND ADR-0066 IS WHY. That record makes the
 * PATH IDENTITY: `/items/<id>` addresses an item and nothing else, so a route
 * spelled `/items/new` puts a VERB inside the identity namespace and every
 * reader of that namespace has to learn the exception. It is not hypothetical
 * -- the paging suites walk a catalogue by scraping `/items/<id>` out of the
 * HTML, and with the create page there they collected `new` as an item id
 * three times over and reported a 254-item catalogue as 257. Moving the route
 * removes the ambiguity instead of teaching every consumer to skip one word.
 *
 * IT ALSO MATCHES THE SURFACES ALREADY HERE. `/import`, `/works`, `/search`
 * and `/login` are all top-level, and this is `/import`'s own counterpart: the
 * catalogue filled by hand beside the catalogue filled from a provider.
 *
 * THE CASE NEITHER INCUMBENT CAN SERVE. Every user-facing creation path in
 * Jellyfin calls `Directory.CreateDirectory` first, so an item there begins as
 * a folder; Calibre is the only mature product shipping anything comparable. A
 * novel the owner does not own is a complete entry here, and this is the page
 * that makes ADR-0003's claim usable rather than merely true of the schema.
 *
 * NO `connection()`, AND THAT IS ADR-0117 OBEYED RATHER THAN SKIPPED. That
 * record's rule is that a read surface declares it needs a request, and names
 * the two ways of declaring it: `connection()`, or "a request-time API the page
 * was going to touch anyway". This page reads the caller's COOKIE to decide
 * whether to render a form at all, which is request-time by the thing it exists
 * to do.
 */
export default async function NewItemPage() {
  const context = await callerContext();
  /*
   * THE KINDS ARE READ EVEN FOR A VISITOR, because the read is open (ADR-0044)
   * and the branch below is about the FORM rather than about the data. Asking
   * conditionally would save one query on a page nobody is waiting on and put a
   * second decision about who may see what next to the one that matters.
   *
   * AND WHETHER ANYBODY CAN LOG IN TO THIS INSTANCE AT ALL (CNCORE-144), which
   * is the SECOND FACT this page answers off and is about the INSTANCE rather
   * than about the reader. ADR-0044's read-only instance sets no
   * `OWNER_PASSWORD`, so every password is refused and nobody obtains a session
   * INCLUDING the owner -- and until this was read, the refusal below offered
   * that reader a login on the one instance where following it lands on a page
   * that says nobody can. `session.configured` is the procedure that answers
   * it, one setting over from `provider.allowlisted`, and it is the same one
   * the empty state and the header ask (ADR-0094, CNCORE-133, CNCORE-139).
   *
   * ASKED FOR THE OWNER TOO, WHERE THE HEADER SHORT-CIRCUITS IT. That procedure
   * reads the setting and nothing else, so it opens no connection and costs no
   * query -- and beside a read this page was making anyway it costs no round
   * trip either. What the header buys with its `&&` is a call skipped on every
   * page an owner opens; there is one page here, and one answer read where a
   * reader of this function can see both facts arrive together is worth more
   * than a call that was never the cost.
   */
  const [{ kinds }, instance] = await Promise.all([
    call(appRouter.item.kinds, undefined, { context }),
    call(appRouter.session.configured, undefined, { context }),
  ]);

  return (
    <main className="container mx-auto max-w-lg px-4 py-8">
      <h1 className="text-3xl font-medium">New item</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Anything you want catalogued, whether or not you have the file and whether or not a provider
        has ever heard of it.
      </p>
      {context.session === null ? (
        <NotYours aPasswordIsSet={instance.password} />
      ) : (
        <NewItemForm kinds={kinds} />
      )}
    </main>
  );
}

/**
 * WHAT A READER WITH NO SESSION IS TOLD, WHICH IS TWO ANSWERS RATHER THAN ONE
 * (CNCORE-144).
 *
 * NO FORM AT ALL RATHER THAN A DISABLED ONE. With no script loaded a Server
 * Action that throws renders a bare `Internal Server Error`, so an offer this
 * page cannot honour costs the reader the page they were on -- the same rule
 * `/import` follows for its own buttons.
 *
 * AND THE LOGIN IS AN OFFER THIS PAGE CANNOT ALWAYS HONOUR EITHER, which is the
 * defect this component carried. Its own docblock used to name ADR-0044's demo
 * -- read-only, with no login, because no password was set -- and then link one
 * regardless: on that instance `session.logIn` refuses every password, so the
 * door has no key cut for it and `/login` itself renders no form. A reader who
 * took the offer arrived at a page telling them nobody can.
 *
 * SO THE INSTANCE IS THE SECOND FACT, and the two sentences here are ADR-0094's
 * second and third answers under "SO THE LIST IS RENDERED FOR A SESSION". Where
 * a password IS set this reader may BE the owner and simply not have used it,
 * and the login is the correct next step rather than a consolation -- the one
 * the README names first. Where none is set there is no step, and the honest
 * thing is the thing `/login` and the empty state both say.
 *
 * THE PROP IS `aPasswordIsSet` RATHER THAN ANYTHING ABOUT LOGGING IN, for the
 * reason `WhoFillsIt` on the front page gives at length: the dangerous name
 * here reads as "is logged in", which is the fact the caller has ALREADY
 * branched on. Named for what the INSTANCE HAS, it cannot be confused with what
 * the reader has done.
 */
function NotYours({ aPasswordIsSet }: { aPasswordIsSet: boolean }) {
  return (
    /*
      A LABELLED SECTION, WHICH IS WHAT THE FORM BESIDE IT ALREADY IS. It is
      what this page answers in place of the form, so it is the same kind of
      thing and gets the same landmark -- and a heading names it for a reader
      moving by one, who otherwise meets a bare sentence hanging under `<h1>`.

      IT IS ALSO THE SEAM THE ANSWER IS ASSERTED AT, and that is worth saying
      rather than leaving to be rediscovered. Since CNCORE-139 the header offers
      this same login on every page of an instance that has a password, so a
      test reading the whole document cannot tell a `/new` that offers one from
      a `/new` that has gone silent inside the shell that does. `sectionIn`
      reads this element; `new-page.test.ts` is where.
    */
    <section className="mt-6" aria-labelledby="who-can-add">
      <h2 id="who-can-add" className="sr-only">
        Who can add to this catalogue
      </h2>
      {aPasswordIsSet ? (
        <p className="text-sm">
          Only the owner of this catalogue can add to it.{" "}
          <Link className="hover:underline" href="/login">
            Log in
          </Link>{" "}
          if that is you.
        </p>
      ) : (
        /*
          THE WORDS `/login` USES FOR THE SAME FACT, deliberately rather than a
          second phrasing of it. A reader who followed a link from here would
          read that page's sentence; a reader who is offered no link should not
          have to wonder whether this instance is broken or whether they are
          missing a button. The empty state on `/` says it this way too.
        */
        <p className="text-sm">
          This instance has no password set, so nobody can log in and nothing can be added through
          it.
        </p>
      )}
    </section>
  );
}

function NewItemForm({ kinds }: { kinds: { value: string; label: string }[] }) {
  return (
    <section className="mt-6" aria-labelledby="new-item">
      <h2 id="new-item" className="sr-only">
        New item
      </h2>
      <form action={createItem} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Title</Label>
          {/*
            `required` SO THE BROWSER ASKS FIRST, and the procedure refuses an
            empty title regardless. The attribute is a courtesy to whoever has
            script; `titleByHand` in the router is the rule.
          */}
          <Input id="title" name="title" required autoComplete="off" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="kind">Kind</Label>
          {/*
            A NATIVE `<select>` RATHER THAN A COMPONENT, and that is this page's
            one real constraint. `packages/ui` has no select, and its `Checkbox`
            is a client component that needs script to toggle -- so either
            control from there would make this surface depend on JavaScript, and
            the ticket's seam is a page over HTTP with no browser. A native
            select submits with no script at all.

            THE SEVEN ARE READ OFF `item_kinds` (ADR-0005, CNCORE-83), so this
            list cannot disagree with the migration that owns the words.

            `work` IS PRESELECTED because it is what an owner cataloguing
            stories wants nearly every time, and `findItemKinds` orders
            alphabetically -- so without this the form would open on Character.
          */}
          <select
            id="kind"
            name="kind"
            defaultValue="work"
            /*
              THE SAME METRICS AS `packages/ui`'s `Input`, which is directly
              above it on this form: `h-8`, `px-2.5`, `text-xs`, `ring-1`.
              Stock shadcn ships `h-9 px-3 text-base ring-[3px]`, and a select
              wearing those sat a step taller and larger than the Title field
              beside it -- `.claude/rules/frontend.md`, "Ported code is where
              this slips". There is no select in `packages/ui` to import, so
              the identity is carried by matching its sibling rather than by
              inheriting a component.
            */
            className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-xs dark:bg-input/30"
          >
            {kinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </div>
        {/*
          ADR-0004: a Container IS an Item, folded into `work` -- there is no
          collection kind, so this is a property of the item rather than a
          different form. `CONTEXT.md`'s Container headword makes it STORED,
          never inferred from having members, which is what lets an owner make
          an EMPTY one and fill it afterwards.

          THREE RADIOS RATHER THAN TWO CHECKBOXES, AND REVIEW IS WHY. Two boxes
          can express "its order means something" WITHOUT "it is a container",
          which `items_ordered_implies_container` (migration 1) refuses -- and
          with no script a Server Action that throws renders a bare `Internal
          Server Error`, so the owner would lose the page they were on. That is
          the exact failure `NotYours` above refuses to inflict on a visitor,
          and it was reachable here by ticking one box.

          THE FIX IS TO MAKE THE STATE UNREPRESENTABLE rather than to validate
          it. The column pair has three legal combinations and this offers
          exactly those three, so the form cannot compose a request the database
          will refuse -- which is better than a check in the action, because a
          check there would bound this door and not the operation.
        */}
        <fieldset className="flex flex-col gap-3">
          <legend className="font-medium text-sm">Does it hold other items?</legend>
          <label htmlFor="holds-nothing" className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              id="holds-nothing"
              name="holds"
              value="nothing"
              defaultChecked
              className="size-4 accent-primary"
            />
            No, it is a thing in its own right
          </label>
          {/*
            ADR-0018 puts ordering on the PLACEMENT, so the difference between
            these two is whether the positions in this container MEAN anything
            -- "Series 1, in order" against "every Dalek story". A container
            without a meaningful order is a real and different thing rather than
            one nobody has sequenced yet.
          */}
          <label htmlFor="holds-unordered" className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              id="holds-unordered"
              name="holds"
              value="unordered"
              className="size-4 accent-primary"
            />
            Yes, in no particular order
          </label>
          <label htmlFor="holds-ordered" className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              id="holds-ordered"
              name="holds"
              value="ordered"
              className="size-4 accent-primary"
            />
            Yes, and their order means something
          </label>
        </fieldset>
        <Button type="submit" className="self-start">
          Create
        </Button>
      </form>
    </section>
  );
}
