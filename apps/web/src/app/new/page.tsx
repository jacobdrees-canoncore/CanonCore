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
   */
  const { kinds } = await call(appRouter.item.kinds, undefined, { context });

  return (
    <main className="container mx-auto max-w-lg px-4 py-8">
      <h1 className="text-3xl font-medium">New item</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Anything you want catalogued, whether or not you have the file and whether or not a provider
        has ever heard of it.
      </p>
      {context.session === null ? <NotYours /> : <NewItemForm kinds={kinds} />}
    </main>
  );
}

/**
 * ADR-0044's demo: read-only, with no login, because no password was set.
 *
 * NO FORM AT ALL RATHER THAN A DISABLED ONE. With no script loaded a Server
 * Action that throws renders a bare `Internal Server Error`, so an offer this
 * page cannot honour costs the reader the page they were on -- the same rule
 * `/import` follows for its own buttons.
 */
function NotYours() {
  return (
    <p className="mt-6 text-sm">
      Only the owner of this catalogue can add to it.{" "}
      <Link className="hover:underline" href="/login">
        Log in
      </Link>{" "}
      if that is you.
    </p>
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
            className="h-9 w-full rounded-none border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
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
          different form. ADR-0009 makes it STORED rather than inferred from
          having members, which is what lets an owner make an EMPTY one and fill
          it afterwards.
        */}
        <fieldset className="flex flex-col gap-3">
          <legend className="font-medium text-sm">Does it hold other items?</legend>
          <label htmlFor="isContainer" className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              id="isContainer"
              name="isContainer"
              className="size-4 accent-primary"
            />
            It is a container
          </label>
          {/*
            ADR-0018 puts ordering on the PLACEMENT, so this says whether the
            positions in this container mean anything -- "Series 1, in order"
            against "every Dalek story". A container left unordered is a real
            and different thing rather than one nobody has sequenced yet.

            `items_ordered_implies_container` (migration 1) refuses ordered
            without container, and the procedure turns that refusal into a
            BAD_REQUEST. Nothing here enforces it, deliberately: a check in this
            form would bound one door and not the operation.
          */}
          <label htmlFor="isOrdered" className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              id="isOrdered"
              name="isOrdered"
              className="size-4 accent-primary"
            />
            Its order means something
          </label>
        </fieldset>
        <Button type="submit" className="self-start">
          Create
        </Button>
      </form>
    </section>
  );
}
