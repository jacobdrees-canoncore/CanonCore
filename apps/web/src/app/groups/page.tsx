import type { Context } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@canoncore/ui/components/empty";
import { Input } from "@canoncore/ui/components/input";
import { Label } from "@canoncore/ui/components/label";
import { call } from "@orpc/server";

import { TheirWords } from "@/components/their-words";
import { callerContext } from "@/session";

import { deleteGroup, drawGroup, renameGroup } from "./actions";

/**
 * The scopes this page renders, as the router answers them.
 *
 * DERIVED FROM THE PROCEDURE rather than imported from `@canoncore/schemas`,
 * which this app deliberately does not depend on: its `package.json` names
 * `@canoncore/api` and reads every payload type back through it, so the shape a
 * page renders is the shape the router actually answers with. The item page
 * derives `ItemOnThePage` the same way.
 */
async function readGroups(context: Context) {
  return (await call(appRouter.group.list, {}, { context })).groups;
}

type GroupOnThePage = Awaited<ReturnType<typeof readGroups>>[number];

/**
 * WHERE THE OWNER DRAWS A BROWSING SCOPE (CNCORE-178, ADR-0010).
 *
 * A PAGE OF ITS OWN RATHER THAN A PANEL ON THE CATALOGUE, because a Group is
 * not a view of the catalogue: it is what a view is NARROWED TO, and the
 * surfaces that narrow are CNCORE-179's and CNCORE-180's. This is where the
 * scopes themselves are kept, which is a different question from which one you
 * are reading through.
 *
 * THE LIST IS OPEN AND THE CONTROLS ARE THE OWNER'S (ADR-0044, ADR-0072), which
 * is the item page's arrangement rather than `/devices`'s. Which scopes a
 * catalogue is organised into is part of the catalogue, and there is no
 * visibility system to hide it behind; what a visitor does not get is a form.
 *
 * IT NEEDS NO JAVASCRIPT, like every other form in this app: each control is an
 * ordinary form post and the answer is the re-rendered list.
 */
export default async function GroupsPage() {
  const context = await callerContext();
  const owner = context.session !== null;
  const groups = await readGroups(context);

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-medium">Groups</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        A Group is a browsing scope: what a view is narrowed to. One catalogue can hold several
        universes, and an Item can sit in as many Groups as it belongs to.
      </p>
      {/*
        THE ONE SENTENCE A READER NEEDS BEFORE THEY WILL USE A SCOPE AT ALL, and
        it is on the page rather than beside the Delete button because it is the
        reason the whole surface is safe to experiment with (ADR-0010, story
        34). It is what tells an Owner that a Group is not a folder.
      */}
      <p className="mt-2 text-muted-foreground text-sm">
        Deleting a Group leaves its Items alone. A scope is not a container, so nothing can be
        emptied by accident.
      </p>
      {owner && <DrawAGroup />}
      <section aria-labelledby="groups" className="mt-8">
        <h2 className="text-xl font-medium" id="groups">
          Your Groups
        </h2>
        {groups.length === 0 ? (
          <Empty className="mt-4 border">
            <EmptyHeader>
              {/*
                A REAL HEADING INSIDE THE PRIMITIVE, for the reason `/works`
                writes out: `EmptyTitle` renders a `div`, so a section labelled
                by one is labelled by something that is not a heading.
              */}
              <EmptyTitle>
                <h3>No Groups yet</h3>
              </EmptyTitle>
              <EmptyDescription>
                {owner
                  ? "Draw one above, then put Items in it from their own pages."
                  : "This catalogue has not been divided into browsing scopes."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="mt-4 flex flex-col divide-y">
            {groups.map((group) => (
              <Group group={group} key={group.id} owner={owner} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/**
 * The form that draws a scope.
 *
 * ONE FIELD, because a Group IS one field (ADR-0010). Every other thing a
 * reader might expect to choose here -- a medium, a set of providers, a root --
 * is what that record refuses to let a scope accumulate.
 */
function DrawAGroup() {
  return (
    <section aria-labelledby="draw-a-group" className="mt-6">
      <h2 className="text-xl font-medium" id="draw-a-group">
        Draw a Group
      </h2>
      <form action={drawGroup} className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="name">Name</Label>
          <Input
            className="mt-1"
            id="name"
            name="name"
            placeholder="Doctor Who"
            required
            type="text"
          />
        </div>
        <Button type="submit">Draw it</Button>
      </form>
    </section>
  );
}

/**
 * One scope: what it is called, and the two things the Owner can do to it.
 *
 * THE NAME IS A HEADING AND THE CONTROLS HANG OFF IT, so a reader navigating by
 * heading reaches the scopes rather than a run of boxes that all read "Name".
 *
 * EACH CONTROL IS ITS OWN LABELLED SECTION, and the labels carry the scope's id
 * because a page holds one per Group: "Rename" repeated down a list names
 * nothing, and two elements sharing an `id` is invalid besides. It is also what
 * lets a reader -- and a test -- address one scope's controls rather than the
 * first ones on the page.
 */
function Group({ group, owner }: { group: GroupOnThePage; owner: boolean }) {
  return (
    <li className="py-3">
      {/*
        `data-group-id` IS THE ONE MARKER, and it is here because the page-seam
        suite reads this list back by it (`group-write.test.ts`). It used to sit
        beside a `data-group-name=""` that carried no name, which review called
        what it was: an attribute whose own name says it holds something it does
        not. The id is enough to find the element, and the heading's text is the
        name -- which is what a reader sees.
      */}
      <h3 className="font-medium" data-group-id={group.id} id={`group-${group.id}`}>
        <TheirWords>{group.name}</TheirWords>
      </h3>
      {owner && (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <section aria-labelledby={`rename-${group.id}`} className="flex-1">
            <h4 className="sr-only" id={`rename-${group.id}`}>
              Rename {group.name}
            </h4>
            <form action={renameGroup} className="flex items-end gap-2">
              <input name="id" type="hidden" value={group.id} />
              <div className="flex-1">
                <Label htmlFor={`name-${group.id}`}>Name</Label>
                <Input
                  className="mt-1"
                  defaultValue={group.name}
                  id={`name-${group.id}`}
                  name="name"
                  required
                  type="text"
                />
              </div>
              <Button size="sm" type="submit" variant="outline">
                Rename
              </Button>
            </form>
          </section>
          {/*
            A SECOND FORM RATHER THAN A SECOND BUTTON IN THE FIRST, because the
            two post different fields: a rename carries the box beside it and a
            deletion must not. A delete button inside the rename form would
            submit whatever the Owner had half-typed.

            NO CONFIRMATION IN FRONT OF IT (ADR-0046), and the sentence at the
            top of this page is why rather than an excuse: deleting a scope
            takes no Item with it, so what it costs is the scope's own
            membership list.
          */}
          <section aria-labelledby={`delete-${group.id}`}>
            <h4 className="sr-only" id={`delete-${group.id}`}>
              Delete {group.name}
            </h4>
            <form action={deleteGroup}>
              <input name="id" type="hidden" value={group.id} />
              <Button size="sm" type="submit" variant="outline">
                Delete
              </Button>
            </form>
          </section>
        </div>
      )}
    </li>
  );
}
