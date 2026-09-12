import { describe, expect, inject, it } from "vitest";

import {
  documentFrom,
  logInAt,
  postFormsIn,
  type RenderedForm,
  sectionIn,
  submit,
} from "./document";

/**
 * CREATING AND EDITING AN ITEM BY HAND (CNCORE-71), at ADR-0103's fourth seam.
 *
 * NO BROWSER, WHICH IS THE TICKET'S OWN CRITERION AND COSTS NOTHING TO MEET.
 * Every control these surfaces carry is a native `<form>`: a Server Action
 * bound to one posts as an ordinary `multipart/form-data` request when no
 * script has loaded, so replaying the form the server just rendered observes
 * exactly what a browser with JavaScript switched off observes. ADR-0103's
 * reservation of Playwright for "what genuinely needs a browser" is untouched.
 *
 * ON AN INSTANCE OF ITS OWN, and that is `aCatalogueSafeToPurge`'s reason
 * rather than a new one. This file RETITLES a provider's item, and the seeded
 * server's imported fixture is asserted on by `item-page.test.ts` down to its
 * `<h1>` -- so editing it there would break another file's fixture mid-run, in
 * whatever order vitest happened to start them. What this file changes is gone
 * for this file alone.
 */
const baseUrl = inject("editableBaseUrl");
const editable = inject("editable");

/**
 * THE OWNER, LOGGED IN, as a cookie this file sends back.
 *
 * EVERY SURFACE BELOW IS THE OWNER'S (CNCORE-109). What a visitor sees instead
 * is asserted at the bottom of this file, because "the demo is read-only" is a
 * claim about these pages rather than about the router underneath them.
 */
const owner = await logInAt(baseUrl, inject("ownerPassword"));

/** One page of this file's own instance. */
function documentAt(path: string, cookie?: string) {
  return documentFrom(baseUrl, path, cookie);
}

/** The form in a labelled section, which is the one that section's button posts. */
function formIn(text: string, label: string): RenderedForm {
  const [form] = postFormsIn(sectionIn(text, label));
  if (!form) throw new Error(`the \`${label}\` section carried no form to submit`);
  return form;
}

/**
 * One rendered form with fields TYPED INTO, leaving Next's own hidden ones alone.
 *
 * IT REFUSES A NAME THE FORM DOES NOT CARRY, which is what stops a typo here
 * posting a field the server ignores and a test passing on a page that never
 * offered it.
 */
function carrying(form: RenderedForm, values: Record<string, string>): RenderedForm {
  const named = new Set(form.fields.map(([name]) => name));
  for (const name of Object.keys(values)) {
    if (!named.has(name)) {
      throw new Error(`that form carries no \`${name}\`: ${JSON.stringify(form.fields)}`);
    }
  }
  return {
    ...form,
    fields: form.fields.map(([name, value]): [string, string] => [name, values[name] ?? value]),
  };
}

/**
 * One rendered form with boxes TICKED, which is a different operation from
 * filling a field and cannot share `carrying`'s check.
 *
 * AN UNTICKED BOX IS ABSENT FROM THE FORM ENTIRELY -- that is HTML's rule and
 * `document.ts` now honours it -- so ticking one ADDS a field where typing into
 * one REPLACES a value. A single helper would have to accept an unknown name to
 * do this, and would then accept a typo in the other case too.
 */
function ticking(form: RenderedForm, boxes: string[]): RenderedForm {
  const named = new Set(form.fields.map(([name]) => name));
  for (const box of boxes) {
    if (named.has(box)) throw new Error(`\`${box}\` is already ticked on the form the server sent`);
  }
  return {
    ...form,
    fields: [...form.fields, ...boxes.map((box): [string, string] => [box, "on"])],
  };
}

/** A field's value as the server rendered it. */
function field(form: RenderedForm, name: string): string | undefined {
  return form.fields.find(([key]) => key === name)?.[1];
}

/** Every value row on an item page, as `property … value … source`. */
function valueRows(text: string): string[] {
  return [...sectionIn(text, "values").matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)].map(([, row]) =>
    (row ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** The `/items/<id>` the browser was sent to after a create. */
function itemAddressIn(text: string): string {
  const found = /<link rel="canonical" href="(\/items\/[0-9a-f-]{36})"/.exec(text)?.[1];
  if (!found) throw new Error("that page declared no canonical item address");
  return found;
}

/**
 * An Item THIS TEST OWNS OUTRIGHT, made through the page.
 *
 * WHY A TEST THAT EDITS CANNOT SHARE A FIXTURE, even inside one file. Vitest
 * runs a file's tests in sequence against one server, so a test that retitles
 * `editable.hand` changes what every later test reading it sees -- which is the
 * same hazard that puts this whole file on its own instance, one scope in. The
 * two tests below that only READ the fixture are the ones that caught it.
 *
 * THROUGH THE PAGE rather than through the database, because the create path is
 * asserted above and a fixture written any other way would be a second opinion
 * about what a created item looks like.
 */
async function anItemOfMyOwn(title: string): Promise<string> {
  const form = formIn((await documentAt("/new", owner)).text, "new-item");
  const created = await submit(baseUrl, "/new", carrying(form, { title, kind: "work" }), owner);
  return itemAddressIn(created.text);
}

describe("/new", () => {
  it("offers all seven of ADR-0005's kinds, in the reader's words", async () => {
    const { status, text } = await documentAt("/new", owner);

    expect(status).toBe(200);
    const offered = [
      ...sectionIn(text, "new-item").matchAll(/<option value="([^"]*)"[^>]*>([^<]*)</g),
    ].map(([, value, label]) => [value, label]);
    // THE SEVEN, PAIRED. ADR-0005 closes the list, and `CONTEXT.md` is binding
    // on the words -- so this is the page agreeing with `item_kinds` rather
    // than with a list somebody typed into a template.
    expect(offered).toEqual([
      ["character", "Character"],
      ["concept", "Concept"],
      ["organisation", "Organisation"],
      ["person", "Person"],
      ["place", "Place"],
      ["time_span", "Time span"],
      ["work", "Work"],
    ]);
  });

  /**
   * ADR-0003's criterion, and the one neither incumbent can meet: every
   * user-facing creation path in Jellyfin calls `Directory.CreateDirectory`
   * first. An Item here is COMPLETE with no file and no provider record.
   */
  it("creates an Item with no Provider record and no file, reachable at its own address", async () => {
    const form = formIn((await documentAt("/new", owner)).text, "new-item");

    const created = await submit(
      baseUrl,
      "/new",
      carrying(form, { title: "A novel I do not own", kind: "work" }),
      owner,
    );

    expect(created.status).toBe(200);
    // THE PAGE IS THE ITEM'S OWN, which is what "reachable" means here: the
    // create redirects to `/items/<id>` (ADR-0066), so the document that comes
    // back declares itself canonical at the address the item now lives at.
    const address = itemAddressIn(created.text);
    expect(created.text).toContain("A novel I do not own");

    // AND IT IS STILL THERE ON A FRESH GET, asked with no cookie at all. A
    // create that only rendered once would satisfy every assertion above.
    const fresh = await documentAt(address);
    expect(fresh.status).toBe(200);
    expect(fresh.text).toContain("A novel I do not own");
    // NO PROVIDER ANYWHERE ON IT. The one claim it carries is the owner's own
    // title, which is ADR-0003 and ADR-0071 on one page: an item nobody but the
    // owner has ever said anything about.
    expect(valueRows(fresh.text)).toEqual(["Title A novel I do not own Owner"]);
  });

  it("creates a Container the owner marks ordered", async () => {
    const form = formIn((await documentAt("/new", owner)).text, "new-item");

    const created = await submit(
      baseUrl,
      "/new",
      ticking(carrying(form, { title: "Series 1, in order", kind: "work" }), [
        "isContainer",
        "isOrdered",
      ]),
      owner,
    );

    // A CONTAINER IS AN ITEM (ADR-0004), so what comes back is an item page --
    // and the page says what sort of thing it is rather than leaving the owner
    // to infer it from an empty Members list.
    expect(created.text).toContain("Ordered container");
  });

  it("creates a Container the owner leaves unordered", async () => {
    // ADR-0018 puts ordering on the placement, so an unordered container is a
    // real and different thing rather than one nobody has sequenced yet.
    const form = formIn((await documentAt("/new", owner)).text, "new-item");

    const created = await submit(
      baseUrl,
      "/new",
      ticking(carrying(form, { title: "Every Dalek story", kind: "work" }), ["isContainer"]),
      owner,
    );

    expect(created.text).toContain("Unordered container");
  });

  /**
   * AN UNCHECKED BOX SUBMITS NOTHING, which is HTML's rule and is what this
   * asserts the app reads correctly. A surface that treated a missing field as
   * anything but "no" would make every item a container.
   */
  it("leaves an Item that is not a container alone", async () => {
    const form = formIn((await documentAt("/new", owner)).text, "new-item");

    const created = await submit(
      baseUrl,
      "/new",
      carrying(form, { title: "The Tenth Planet, as I think of it", kind: "work" }),
      owner,
    );

    // THE `Holds` ROW IS ABSENT, which is the assertion rather than "the word
    // container does not appear": the page's own `<main>` carries
    // `class="container mx-auto"`, so a substring check passes on every page
    // here and fails on none.
    expect(created.text).not.toContain("Holds");
    expect(created.text).not.toContain("Unordered container");
  });
});

describe("/items/<id>, editing a title", () => {
  it("shows the Owner as the source of the new value", async () => {
    const at = await anItemOfMyOwn("What I first called it");
    const before = await documentAt(at, owner);
    expect(valueRows(before.text)).toEqual(["Title What I first called it Owner"]);

    const edited = await submit(
      baseUrl,
      at,
      carrying(formIn(before.text, "edit-title"), { title: "A better title" }),
      owner,
    );

    expect(edited.status).toBe(200);
    expect(valueRows(edited.text)).toEqual(["Title A better title Owner"]);
    // AND THE HEADING MOVED WITH IT, which is the projection (ADR-0014) rather
    // than the list: a page whose Values row changed while its `<h1>` did not
    // would be showing a reader two answers to one question.
    expect(edited.text).toContain('<h1 class="text-3xl font-medium">A better title</h1>');
  });

  /**
   * ADR-0025's whole point, on a page. The owner sits at `source_order` 0, so
   * their value outranks the provider's before ranks are considered -- and the
   * provider's claim is STILL THERE, which is what separates this from
   * Jellyfin's first-non-empty-wins merge (ADR-0026).
   */
  it("beats the Provider's title, without erasing it", async () => {
    const at = `/items/${editable.imported}`;
    const before = await documentAt(at, owner);
    expect(before.text).toContain(
      `<h1 class="text-3xl font-medium">${editable.importedTitle}</h1>`,
    );

    const edited = await submit(
      baseUrl,
      at,
      carrying(formIn(before.text, "edit-title"), { title: "The Tenth Planet" }),
      owner,
    );

    expect(edited.text).toContain('<h1 class="text-3xl font-medium">The Tenth Planet</h1>');
    const rows = valueRows(edited.text);
    // THE OWNER'S FIRST AND THE PROVIDER'S BELOW IT, in the order the projection
    // picks them: winner first, by rank then the global source order.
    expect(rows).toContain("Title The Tenth Planet Owner");
    expect(rows).toContain(`Title ${editable.importedTitle} ${editable.providerLabel}`);
    expect(rows.indexOf("Title The Tenth Planet Owner")).toBeLessThan(
      rows.indexOf(`Title ${editable.importedTitle} ${editable.providerLabel}`),
    );
  });
});

describe("what a visitor is offered", () => {
  /**
   * ADR-0044: the demo is read-only with no login. A button whose action
   * answers UNAUTHORIZED is worse than no button -- with no script loaded a
   * Server Action that throws renders a bare `Internal Server Error`, so an
   * offer the page cannot honour costs the reader the page they were on.
   */
  it("shows an item without offering to edit it", async () => {
    const { status, text } = await documentAt(`/items/${editable.hand}`);

    expect(status).toBe(200);
    expect(text).toContain(editable.handTitle);
    expect(() => sectionIn(text, "edit-title")).toThrow();
  });

  it("refuses the create page outright rather than rendering a form that cannot work", async () => {
    const { status, text } = await documentAt("/new");

    expect(status).toBe(200);
    expect(() => sectionIn(text, "new-item")).toThrow();
    expect(text).toContain("Log in");
  });
});

describe("the form the server rendered", () => {
  /**
   * THE EDIT FORM OPENS ON THE TITLE THE ITEM ALREADY HAS, which is what makes
   * it an edit rather than a replace-from-blank. An owner correcting one word
   * should not have to retype the sentence.
   */
  it("carries the current title as the field's value", async () => {
    const { text } = await documentAt(`/items/${editable.hand}`, owner);

    expect(field(formIn(text, "edit-title"), "title")).toBe(editable.handTitle);
  });

  /** The create form opens on `work`, which is what an owner makes nearly every time. */
  it("preselects Work on the create form", async () => {
    const { text } = await documentAt("/new", owner);

    expect(field(formIn(text, "new-item"), "kind")).toBe("work");
  });
});
