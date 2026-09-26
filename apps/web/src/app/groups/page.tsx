import type { Context } from "@canoncore/api/context";
import { appRouter } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@canoncore/ui/components/empty";
import { Input } from "@canoncore/ui/components/input";
import { Label } from "@canoncore/ui/components/label";
import { call } from "@orpc/server";
import Form from "next/form";
import Link from "next/link";

import { whatTheProcedureAnswered } from "@/answer";
import { counted } from "@/components/counted";
import { oneGroup } from "@/components/query-params";
import { TheirWords } from "@/components/their-words";
import { callerContext } from "@/session";

import { askProvider, deleteGroup, drawGroup, renameGroup, stopAskingProvider } from "./actions";

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
 * What deleting one scope would take, as `group.previewDelete` answers it.
 *
 * NOTHING FOR A SCOPE ANOTHER TAB DELETED since the list was read: the
 * procedure refuses it, and the answer to that is the list without it rather
 * than a 500 (ADR-0066).
 */
async function readDeletion(context: Context, id: string) {
  return (await whatTheProcedureAnswered(call(appRouter.group.previewDelete, { id }, { context })))
    .answered;
}

type GroupDeletion = NonNullable<Awaited<ReturnType<typeof readDeletion>>>;

/**
 * WHO EACH SCOPE ASKS (CNCORE-182): the Providers this instance searches, and
 * which of them each Group asks.
 *
 * READ FOR ANY READER, as `group.asks` is: searching within a scope is open and
 * names the Providers it asked, so leaving them off this page would hide
 * nothing. What a visitor is not served is the buttons.
 *
 * ONE READ PER GROUP, which is a count of scopes drawn by hand rather than of
 * anything the corpus grows (`findGroups` gives the reason it is uncapped).
 */
async function readAsking(context: Context, groups: GroupOnThePage[]) {
  const [{ providers }, asked] = await Promise.all([
    call(appRouter.provider.configured, undefined, { context }),
    Promise.all(
      groups.map(async (group) => {
        const { providers: asks } = await call(appRouter.group.asks, { id: group.id }, { context });
        return [group.id, asks] as const;
      }),
    ),
  ]);
  return { configured: providers, asked: new Map(asked) };
}

type Asking = Awaited<ReturnType<typeof readAsking>>;

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
 *
 * AND `?delete=<id>` IS WHERE DELETING ONE ASKS FIRST (ADR-0046, CNCORE-210),
 * which is the purge's arrangement on `/import`: a page at its own address,
 * which nothing dismisses by accident.
 */
export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ delete?: string | string[] }>;
}) {
  const context = await callerContext();
  const owner = context.session !== null;
  const groups = await readGroups(context);
  /*
   * ONLY A SCOPE THIS PAGE LISTS, AND ONLY FOR THE OWNER. The list is where the
   * name comes from, and anything else in the address -- a scope already gone,
   * a typo -- is the list rather than a 500. Read by `oneGroup`, so an id typed
   * in capitals still names its Group (ADR-0066). A visitor is never previewed for:
   * the preview IS the delete, rolled back, so it is the Owner's like the
   * delete, and asking it for a visitor would be asking for a 401.
   */
  const named = oneGroup((await searchParams).delete);
  const deleting = owner ? groups.find((group) => group.id === named) : undefined;
  const deletion = deleting && (await readDeletion(context, deleting.id));
  if (deleting !== undefined && deletion !== undefined) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-medium">Groups</h1>
        <ConfirmDeletion deletion={deletion} group={deleting} />
      </main>
    );
  }
  const asking = await readAsking(context, groups);

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
              <Group asking={asking} group={group} key={group.id} owner={owner} />
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
 * ONE FIELD, because a Group IS one field (ADR-0010). A medium, a field set or
 * a root is what that record refuses to let a scope accumulate. Which Providers
 * it asks IS one of the five things that record says a scope decides, and it is
 * chosen below once the scope exists (CNCORE-182) rather than here: a new Group
 * asks none until the Owner says, which is ADR-0025's sentence and not a gap in
 * this form.
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
            placeholder="A name for the Group"
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
function Group({
  asking,
  group,
  owner,
}: {
  asking: Asking;
  group: GroupOnThePage;
  owner: boolean;
}) {
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
            two send different fields: a rename carries the box beside it and a
            deletion must not.

            AND IT DELETES NOTHING: it asks (ADR-0046, CNCORE-210). A GET to
            this page naming the scope, which renders what the deletion would
            take and the one button that takes it -- the ellipsis is the
            convention for a command that asks before it acts. That is this
            control's FIRST reason to be a form and it depends on no framework
            behaviour at all.

            `Form` RATHER THAN `Link` IS THE SECOND, for the purge's reason on
            `/import`: this address runs the delete and rolls it back, so a list
            of links would put that on an address nobody asked for. NOT, as this
            comment once said, "for every scope a reader scrolled past" -- a
            prefetch of this dynamic route is skipped and runs nothing, measured
            2026-09-20 (ADR-0161). The absence is a property of the
            configuration, and the form holds under every change that ends it.
          */}
          <section aria-labelledby={`delete-${group.id}`}>
            <h4 className="sr-only" id={`delete-${group.id}`}>
              Delete {group.name}
            </h4>
            <Form action="/groups">
              <input name="delete" type="hidden" value={group.id} />
              <Button size="sm" type="submit" variant="outline">
                Delete…
              </Button>
            </Form>
          </section>
        </div>
      )}
      <Asks
        asked={asking.asked.get(group.id) ?? []}
        configured={asking.configured}
        group={group}
        owner={owner}
      />
    </li>
  );
}

/**
 * WHAT DELETING A SCOPE TAKES, IN FRONT OF THE DELETION (ADR-0046, CNCORE-210).
 *
 * WHAT GOES AND WHAT DOES NOT, both said. The scope goes with its Group
 * memberships and the Providers it asks, and there is no restoring one. No Item
 * goes (ADR-0010, story 34), which is the sentence that tells an Owner the
 * cost is a list they would have to put together again rather than any of the
 * catalogue.
 *
 * ASKED EVEN OF AN EMPTY SCOPE, where the purge asks nothing of a provider with
 * nothing to take: a deletion always takes the scope itself, so there is never
 * nothing here.
 */
function ConfirmDeletion({ deletion, group }: { deletion: GroupDeletion; group: GroupOnThePage }) {
  return (
    <section aria-labelledby="delete-group" className="mt-6">
      <h2 className="text-xl font-medium" id="delete-group">
        Delete <TheirWords>{group.name}</TheirWords>
      </h2>
      <p className="mt-2 text-muted-foreground text-sm">
        This cannot be undone. Along with the Group itself, deleting it takes
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        <li>{`${counted(deletion.memberships, "Group membership")}, the list of which Items are in it`}</li>
        {deletion.providers > 0 && (
          <li>{`its choice of ${counted(deletion.providers, "Provider")} to ask when you search within it`}</li>
        )}
      </ul>
      <p className="mt-3 text-muted-foreground text-sm">
        No Item is deleted. Every Item in it stays in your catalogue, wherever it is placed and in
        every other Group it is in.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/*
          CANCEL FIRST AND AS A PLAIN LINK, the purge's weighting: leaving is a
          choice that costs nothing, and the only way on is the one button.
        */}
        <Link className="text-sm hover:underline" href="/groups">
          Cancel
        </Link>
        <form action={deleteGroup}>
          <input name="id" type="hidden" value={group.id} />
          <Button type="submit" variant="destructive">
            Delete permanently
          </Button>
        </form>
      </div>
    </section>
  );
}

/**
 * WHICH PROVIDERS ONE SCOPE ASKS, AND THE WAY TO CHANGE IT (CNCORE-182,
 * ADR-0025): every Provider this instance searches, each asked or not.
 *
 * EVERY CONFIGURED PROVIDER, NOT ONLY THE ASKED ONES, because the choice is
 * among them: a Group picks from the Providers this instance names and never
 * adds to them, so the list to choose from is `/settings`' own.
 *
 * A BUTTON PER PROVIDER RATHER THAN A SET OF TICKBOXES, which is `/settings`'
 * own arrangement for the same list: each posts one change, so a stale page
 * changes the one Provider its button names rather than writing back every
 * box as that page last saw them.
 *
 * NO ORDER TO SET, which is the decision rather than a missing control. The
 * source order is one for the whole instance (ADR-0025), so a Group chooses
 * who is asked and never how they rank.
 *
 * NAMED BY URL, which `BrowseBox` on `/import` already does for any reader, and
 * with the buttons for the Owner alone -- that page's arrangement: a visitor is
 * shown the whole surface and none of its controls. Each Provider is a section
 * labelled by the scope and the URL together, because a page holds one per pair
 * and the label is what lets a reader, and a test, address one pair's control.
 */
function Asks({
  asked,
  configured,
  group,
  owner,
}: {
  asked: readonly string[];
  configured: readonly string[];
  group: GroupOnThePage;
  owner: boolean;
}) {
  return (
    <section aria-labelledby={`asks-${group.id}`} className="mt-3">
      <h4 className="text-sm" id={`asks-${group.id}`}>
        Providers searched within <TheirWords>{group.name}</TheirWords>
      </h4>
      {configured.length === 0 ? (
        <p className="mt-1 text-muted-foreground text-sm">
          This instance searches no Provider yet.
          {owner && (
            <>
              {" "}
              Name one in{" "}
              <Link className="underline" href="/settings">
                Settings
              </Link>
              , then choose here which Groups ask it.
            </>
          )}
        </p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {configured.map((baseUrl) => {
            const asks = asked.includes(baseUrl);
            const label = `ask-${group.id}-${baseUrl}`;
            return (
              <li key={baseUrl}>
                <section aria-labelledby={label} className="flex items-center gap-3 text-sm">
                  <h5 className="min-w-0 flex-1" id={label}>
                    <TheirWords>{baseUrl}</TheirWords>
                  </h5>
                  <span className="text-muted-foreground">{asks ? "Asked" : "Not asked"}</span>
                  {owner && (
                    <form action={asks ? stopAskingProvider : askProvider}>
                      <input name="id" type="hidden" value={group.id} />
                      <input name="baseUrl" type="hidden" value={baseUrl} />
                      <Button size="sm" type="submit" variant="outline">
                        {asks ? "Stop asking" : "Ask"}
                      </Button>
                    </form>
                  )}
                </section>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
