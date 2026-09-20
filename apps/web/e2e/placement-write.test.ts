import { describe, expect, inject, it } from "vitest";

import {
  documentFrom,
  formIn,
  logInAt,
  navigatingFormsIn,
  postFormsIn,
  type RenderedForm,
  sectionIn,
  submit,
  withFields,
} from "./document";

/**
 * PLACING AN ITEM IN A CONTAINER AND TAKING IT OUT AGAIN (CNCORE-72), at
 * ADR-0103's fourth seam.
 *
 * NO BROWSER, WHICH IS THE TICKET'S OWN CRITERION. Every control these surfaces
 * carry is a native `<form>` bound to a Server Action, which React posts as an
 * ordinary `multipart/form-data` request when no script has loaded -- so
 * replaying the form the server just rendered observes exactly what a browser
 * with JavaScript switched off observes.
 *
 * ON AN INSTANCE OF ITS OWN, for `aCatalogueSafeToEdit`'s reason one operation
 * along: these tests CHANGE WHAT CONTAINERS HOLD, and every container on the
 * seeded instance is somebody else's fixture, asserted row by row.
 */
const baseUrl = inject("curatableBaseUrl");
const curatable = inject("curatable");

const owner = await logInAt(baseUrl, inject("ownerPassword"));

function documentAt(path: string, cookie?: string) {
  return documentFrom(baseUrl, path, cookie);
}

/** The container's own page, which is where its membership is curated. */
function containerPage(id: string, cookie?: string) {
  return documentAt(`/items/${id}`, cookie);
}

/**
 * Places an item into a container through the page, as an owner does: the form
 * the container's own page renders, submitted with no script.
 */
async function place(
  container: string,
  { itemId, position }: { itemId: string; position: string },
) {
  const { text } = await containerPage(container, owner);
  const form = withFields(formIn(text, "place-an-item"), { itemId, position });
  return submit(baseUrl, `/items/${container}`, form, owner);
}

/** The Members rows a page is showing, as the reader reads them. */
function membersIn(text: string): string[] {
  return [...sectionIn(text, "members").matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)].map(([, row]) =>
    (row ?? "")
      .replaceAll(/<[^>]*>/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim(),
  );
}

/**
 * The Remove form on ONE member's row, found by what that row says.
 *
 * BY THE ROW RATHER THAN BY POSITION IN THE LIST, because a Repeat puts one
 * title in an ordering twice and the position is what tells the two apart --
 * which is the same fact that makes every mutation name a Placement (ADR-0061).
 *
 * AND BY THE BUTTON'S LABEL RATHER THAN BY BEING THE ROW'S ONLY FORM, which is
 * what CNCORE-73 turned from true into false: a row now carries Move up and
 * Move down beside Remove, so "the first form in this row" silently became the
 * reorder and this file went on calling it a removal. The label is the handle a
 * reader uses, so it is the one to find the form by.
 */
function rowFor(text: string, title: string, position: string): RenderedForm {
  const rows = [...sectionIn(text, "members").matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)];
  const row = rows.find(
    ([, body]) => (body ?? "").includes(title) && (body ?? "").includes(position),
  );
  if (!row) throw new Error(`no member row for ${title} at ${position}`);
  const removing = [...(row[1] ?? "").matchAll(/<form\b[^>]*>.*?<\/form>/gis)]
    .map(([whole]) => whole)
    .find((form) => form.includes("Remove"));
  if (!removing) throw new Error(`the row for ${title} at ${position} carried no Remove`);
  const [form] = postFormsIn(removing);
  if (!form) throw new Error(`the Remove on ${title} at ${position} did not parse as a form`);
  return form;
}

describe("placing an item in a container", () => {
  it("puts the item in the container's Members list, at the position the owner gave", async () => {
    const after = await place(curatable.releaseOrder, {
      itemId: curatable.story,
      position: "63",
    });

    expect(after.status).toBe(200);
    expect(membersIn(after.text)).toStrictEqual([expect.stringContaining(curatable.storyTitle)]);
    expect(membersIn(after.text)[0]).toContain("#63");
  });

  it("puts the same item in a SECOND container, and both orderings stand", async () => {
    // THE PRODUCT'S CENTRAL CLAIM, performed by hand at the page seam: one item
    // in two orderings at two positions, both true at once (ADR-0009). The
    // second placement does not disturb the first, because every container owns
    // its membership outright (ADR-0061).
    await place(curatable.releaseOrder, { itemId: curatable.otherStory, position: "1" });

    const after = await place(curatable.storyOrder, {
      itemId: curatable.otherStory,
      position: "9",
    });

    expect(membersIn(after.text)).toStrictEqual([expect.stringContaining(curatable.otherTitle)]);
    expect(membersIn(after.text)[0]).toContain("#9");

    // AND THE FIRST ORDERING IS UNTOUCHED, read back from its own page.
    const release = await containerPage(curatable.releaseOrder, owner);
    expect(
      membersIn(release.text).filter((row) => row.includes(curatable.otherTitle)),
    ).toStrictEqual([expect.stringContaining("#1")]);
  });

  it("places the same item in ONE container twice, at distinct positions -- a Repeat", async () => {
    // ADR-0009 licences it and CONTEXT.md names it: a recap at one position and
    // the episode at another are one item, twice, on purpose. Asserted HERE and
    // not only at the db seam because the corrections singled this criterion out
    // -- the refusal below is the same gesture at ONE position, and a reader
    // meets both on this page.
    await place(curatable.releaseOrder, { itemId: curatable.story, position: "101" });
    const after = await place(curatable.releaseOrder, {
      itemId: curatable.story,
      position: "102",
    });

    const repeated = membersIn(after.text).filter(
      (row) => row.includes(curatable.storyTitle) && /#10[12]/.test(row),
    );
    expect(repeated).toHaveLength(2);
  });

  it("places two DIFFERENT items at ONE position, without inventing an order between them", async () => {
    // ADR-0009, and the absence of a unique on (container, position) is the
    // decision: a story-order container holding both a novel and the film
    // adapting it must place them at one point. The page must not quietly fix
    // that up either.
    await place(curatable.storyOrder, { itemId: curatable.story, position: "200" });
    const after = await place(curatable.storyOrder, {
      itemId: curatable.otherStory,
      position: "200",
    });

    const shared = membersIn(after.text).filter((row) => row.includes("#200"));
    expect(shared).toHaveLength(2);
    expect(shared.join(" ")).toContain(curatable.storyTitle);
    expect(shared.join(" ")).toContain(curatable.otherTitle);
  });

  it("places an item with NO position, and the row says so rather than guessing", async () => {
    // CONTEXT.md's Unplaced: a member with no position is still a member, and
    // the reader's words are "no position given". An empty field is how an owner
    // says it.
    const after = await place(curatable.storyOrder, { itemId: curatable.story, position: "" });

    /*
     * THE UNPLACED ROW AMONG THAT ITEM'S ROWS, rather than "the only row it
     * has". This file places the same item into this ordering more than once --
     * a Repeat is the point of a test above -- so an assertion counting every
     * row for a title was really asserting what the file had done SO FAR, and it
     * went red when a test above it placed one more.
     */
    expect(
      membersIn(after.text).filter(
        (row) => row.includes(curatable.storyTitle) && row.includes("No position given"),
      ),
    ).toHaveLength(1);
  });
});

/**
 * WHAT THE PICKER IS OFFERING, as the titles a reader reads in it.
 *
 * THE OPTIONS RATHER THAN THE CHOSEN ONE, which is what `selectsIn` answers and
 * why this is not that helper. A browser submits one value; what this file has
 * to see is the whole list, because the defect under test is an item the list
 * does not CONTAIN.
 */
function offeredIn(text: string): string[] {
  const picker = /<select\b[^>]*\bname="itemId"[^>]*>(.*?)<\/select>/is.exec(
    sectionIn(text, "place-an-item"),
  );
  if (!picker) throw new Error("the placement picker rendered no list of items to choose from");
  return [...(picker[1] ?? "").matchAll(/<option\b[^>]*>(.*?)<\/option>/gis)].map(
    ([, title]) => title ?? "",
  );
}

/**
 * The picker's own search, submitted the way a browser submits a GET form: the
 * address its fields name, asked for.
 *
 * NOT `submit`, WHICH POSTS. This control navigates -- it asks the container's
 * own page a narrower question rather than changing anything -- so what a
 * browser does with it is build an address and follow it, and that is what is
 * replayed here.
 */
async function searchThePicker(container: string, query: string) {
  const { text } = await containerPage(container, owner);
  const [box] = navigatingFormsIn(sectionIn(text, "place-an-item"));
  if (!box) throw new Error("the placement picker offers no search of its own");
  const asked = new URLSearchParams(withFields(box, { placing: query }).fields);
  return { at: `${box.action}?${asked}`, ...(await documentAt(`${box.action}?${asked}`, owner)) };
}

/**
 * THE FIELD A VISIBLE LABEL NAMES, as the name it submits under -- or a throw
 * saying which half is missing.
 *
 * IT FOLLOWS THE LABEL TO THE FIELD RATHER THAN LOOKING FOR EITHER ALONE, which
 * is the whole point of it here. CNCORE-256 is a notice that named a remedy
 * NOTHING ON THE PAGE PROVIDED, and a test that merely found the words would
 * have passed against exactly that page. What says a remedy exists is that the
 * words lead to a control: a label, its `for`, a field carrying that id, and a
 * name that gets submitted.
 */
function theFieldLabelled(section: string, label: string): string {
  const named = new RegExp(`<label\\b[^>]*\\bfor="([^"]*)"[^>]*>${label}</label>`, "i").exec(
    section,
  )?.[1];
  if (named === undefined) throw new Error(`nothing in that section is labelled \`${label}\``);
  const field = new RegExp(`<(?:input|select|textarea)\\b[^>]*\\bid="${named}"[^>]*>`, "i").exec(
    section,
  )?.[0];
  if (field === undefined) throw new Error(`\`${label}\` labels no field on that page`);
  const submits = /\bname\s*=\s*"([^"]*)"/i.exec(field)?.[1];
  if (submits === undefined) throw new Error(`the field \`${label}\` names submits nothing`);
  return submits;
}

describe("reaching an item the picker does not offer", () => {
  it("finds an item past the picker's first hundred, and places it", async () => {
    /*
     * THE CRITERION (CNCORE-256), AND ITS FIRST LINE IS THE DEFECT. The picker
     * is ONE PAGE of the catalogue by name -- ADR-0119's cap, a hundred rows --
     * so an item sorting past the hundredth cannot be chosen from it at all. On
     * the Owner's own install that is 100 reachable of 8,052.
     *
     * AND THE REMEDY IS REACH RATHER THAN RELOCATION. ADR-0061 gives the
     * container its membership outright, so the control stays on the
     * container's page and what changes is how the Owner gets to an item
     * through it.
     */
    const before = await containerPage(curatable.reaching, owner);
    expect(offeredIn(before.text)).not.toContain(curatable.beyondThePageTitle);

    const found = await searchThePicker(curatable.reaching, "Zoe");
    expect(offeredIn(found.text)).toContain(curatable.beyondThePageTitle);

    /*
     * AND PLACING IT IS THE HALF THAT MAKES THIS REACH rather than a narrower
     * list to look at. The form the narrowed page rendered, posted to the
     * address that page was served at -- which is what an empty `action` means
     * in HTML and what a browser with no script does with it.
     */
    const form = withFields(formIn(found.text, "place-an-item"), {
      itemId: curatable.beyondThePage,
      position: "300",
    });
    const after = await submit(baseUrl, found.at, form, owner);

    expect(after.status).toBe(200);
    expect(membersIn(after.text)).toStrictEqual([
      expect.stringContaining(curatable.beyondThePageTitle),
    ]);
    expect(membersIn(after.text)[0]).toContain("#300");
  });

  it("keeps the picker narrowed when the catalogue refuses the placement", async () => {
    /*
     * A REFUSAL MUST NOT COST THE OWNER THEIR SEARCH. The refusal travels
     * through a redirect (CNCORE-255), which builds an address of its own --
     * so an address that named only what was refused would hand back the
     * UNNARROWED picker, and the item the Owner was placing would be out of
     * reach again at the one moment they are being asked to try something else.
     *
     * THE SECOND PLACEMENT AT ONE POSITION IS THE REFUSAL, which ADR-0009
     * licences only at a DIFFERENT position.
     */
    const found = await searchThePicker(curatable.reaching, "Zoe");
    const twice = withFields(formIn(found.text, "place-an-item"), {
      itemId: curatable.beyondThePage,
      position: "301",
    });
    await submit(baseUrl, found.at, twice, owner);

    const again = await submit(baseUrl, found.at, twice, owner);

    expect(sectionIn(again.text, "place-an-item")).toContain(
      "That item is already here at that position",
    );
    expect(offeredIn(again.text)).toContain(curatable.beyondThePageTitle);
  });

  it("names a remedy that exists on the page the notice is on", async () => {
    /*
     * THE TICKET'S SECOND CRITERION, AND THE DEFECT IT REPLACES. This notice
     * read "Search for one to place it from its own page" -- and an Item's own
     * page offers `EditTitle`, `EditSortName`, `Note`, `Members`, a read-only
     * "Also appears in" and its Groups, and NO way to place it into anything.
     * So the one instruction the Owner was given could not be followed.
     *
     * ASSERTED BY FOLLOWING THE WORDS TO A CONTROL rather than by matching
     * them. A test that only read the sentence would have gone green against
     * the sentence this replaces, which is precisely the failure being fixed.
     */
    const { text } = await containerPage(curatable.storyOrder, owner);
    const section = sectionIn(text, "place-an-item");

    expect(section).toContain("Find an item above");

    // The words lead to a label, the label to a field, and the field is the one
    // this section's own search submits -- on this page, not on the item's.
    const submits = theFieldLabelled(section, "Find an item");
    const [box] = navigatingFormsIn(section);
    expect(box?.fields.map(([name]) => name)).toContain(submits);
  });

  it("carries the rest of the address, so searching it moves nothing else on the page", async () => {
    /*
     * `TheRoute`'s RULE FOR A THIRD CONTROL ON ONE ADDRESS. A Container IS an
     * Item (ADR-0004), so `/items/<id>` already carries the ordering the reader
     * arrived through, the origin "Also appears in" is narrowed to, and where
     * each of those two listings stands. The picker is a third thing with a
     * position of its own, and a search aimed at it must leave the other two
     * exactly where the Owner left them -- which is the same argument the two
     * cursors already make about each other.
     *
     * `?via=` IS THE ONE THIS INSTANCE CAN CARRY. It identifies nothing
     * (ADR-0066), so a value naming no placement is a legitimate address and
     * the page renders the same either way -- what is under test is whether the
     * control hands it on, not what it means.
     */
    const { text } = await documentAt(`/items/${curatable.storyOrder}?via=carried-through`, owner);
    const [box] = navigatingFormsIn(sectionIn(text, "place-an-item"));

    expect(box?.fields).toContainEqual(["via", "carried-through"]);
    // AND THE QUERY STANDS LAST, because a browser submits fields in document
    // order and that order IS the address this control writes (ADR-0066).
    expect(box?.fields.at(-1)?.[0]).toBe("placing");
  });

  it("says so when nothing matches, rather than offering a picker with nothing in it", async () => {
    /*
     * ADR-0116's rule where a search comes back empty: the select is
     * `required`, so an empty one is a control the Owner can press Place on
     * and be refused by for something that is not their doing. And an empty
     * list under a heading reads as a section that failed to load rather than
     * as an answer, which is the argument `/search` makes for its own
     * "nothing matched".
     */
    const found = await searchThePicker(curatable.storyOrder, "Nothing here goes by this name");
    const section = sectionIn(found.text, "place-an-item");

    expect(section).toContain("Nothing in the catalogue matches that");
    expect(() => offeredIn(found.text)).toThrow();
    // AND THE WAY BACK, which is the state a reader is most stuck in: a search
    // that found nothing, with no list to pick from and nothing to edit.
    expect(section).toContain("Show the whole catalogue");
  });
});

describe("what the owner is refused", () => {
  it("says the item is already there rather than failing, for a Repeat at ONE position", async () => {
    // ADR-0116: "A UI that permits the gesture and then fails the write is worse
    // than one that refuses the gesture." With no script a form cannot know
    // which positions are taken, so the honest version is that the refusal comes
    // back as a SENTENCE on the page rather than as a 500.
    const twice = { itemId: curatable.story, position: "40" };
    await place(curatable.releaseOrder, twice);

    const after = await place(curatable.releaseOrder, twice);

    expect(after.status).toBe(200);
    /*
     * AND IT SAYS WHICH OF THE FOUR (CNCORE-275). This asserted "Nothing was
     * placed" alone, which passed while the page named two causes out of
     * `placement.place`'s four -- so a cycle or a position the column cannot
     * hold rendered as "already here, or no longer in the catalogue", a FALSE
     * reason rather than a vague one. The action now carries the CAUSE and the
     * page answers it, so this asserts the words the Owner reads.
     */
    expect(sectionIn(after.text, "place-an-item")).toContain(
      "That item is already here at that position",
    );
  });

  it("says a container cannot hold itself, which the page could never have named", async () => {
    /*
     * THE CAUSE THE HARDCODED SENTENCE HAD NO WORDS FOR. A container placed
     * inside itself is refused by `refuse_placement_cycle` (migration 15), and
     * before CNCORE-275 this page answered it with "already here at that
     * position ... or no longer in the catalogue" -- neither of which is true.
     * This is the assertion that the page stopped inventing the reason.
     */
    const itself = {
      itemId: curatable.releaseOrder,
      position: "41",
    };

    const after = await place(curatable.releaseOrder, itself);

    expect(after.status).toBe(200);
    expect(sectionIn(after.text, "place-an-item")).toContain(
      "A container cannot hold itself, or anything it already sits inside",
    );
  });
});

/**
 * EVERY NON-IDENTIFYING PARAMETER `/items/<id>` TAKES, on one address.
 *
 * NONE OF THEM IDENTIFIES ANYTHING, which is what makes them safe to write out
 * by hand (ADR-0066): `via` names the ordering a reader arrived through and
 * `placed` the origin "Also appears in" is narrowed to, and a cursor naming no
 * Row is the start of its listing rather than an error -- `canBeAnId` guards
 * the shape before the comparison, so the page renders the same either way.
 * What is under test is whether a REFUSAL hands them back, not what they mean.
 *
 * `placing` IS THE ONE THAT HAS TO MATCH SOMETHING, because a search matching
 * nothing renders no place form at all (ADR-0116) and there would be nothing to
 * submit. "Zoe" is the one title on this instance past the picker's first
 * hundred.
 *
 * THE FORWARD CURSORS, WHICH IS HALF THE PAIR. `after` and `before` never share
 * a link -- each names where one page starts -- so the step back is a second
 * address and the test below it.
 */
const wholeAddress = {
  via: "arrived-through-this",
  placed: "narrowed-to-this",
  after: "members-page-two",
  placedAfter: "appearances-page-two",
  placing: "Zoe",
};

describe("where a refusal leaves the Owner", () => {
  /**
   * A CONTAINER PLACED INSIDE ITSELF, which refuses and writes NOTHING --
   * `refuse_placement_cycle`, migration 15. So these tests leave the instance
   * exactly as they found it and may run in any order beside the rest of this
   * file, which is what every other refusal here has to be careful about.
   */
  async function refusedFrom(at: string) {
    const { text } = await documentAt(at, owner);
    const itself = withFields(thePlaceForm(text), {
      itemId: curatable.reaching,
      position: "500",
    });
    return submit(baseUrl, at, itself, owner);
  }

  /**
   * THE PLACE FORM, WHICH IS NOT ALWAYS THE FIRST FORM IN ITS SECTION.
   *
   * FOUND BY THE FIELD IT SUBMITS rather than by position. `formIn` answers the
   * first POST form under a heading, and when an offer is standing
   * `UndoRemoval` renders ABOVE this one -- so on the one page where both
   * controls are up, "the form in that section" is the undo. That is how the
   * assertion below first went red: on the harness, not on the page.
   */
  function thePlaceForm(text: string): RenderedForm {
    const form = postFormsIn(sectionIn(text, "place-an-item")).find(({ fields }) =>
      fields.some(([name]) => name === "itemId"),
    );
    if (!form) throw new Error("that page offers no form for placing an item");
    return form;
  }

  it("hands back every parameter the address carried, in the fixed order", async () => {
    /*
     * THE TICKET'S FIRST CRITERION (CNCORE-290). CNCORE-256 gave this redirect
     * `?placing=` and left the other two positions on the address behind: the
     * POST form submitted what the WRITE needs and the narrowing, so `?via=`,
     * `?placed=` and both listings' cursors were not on it to carry. A reader
     * on page three of Members who was refused one placement came back to page
     * one of Members AND page one of "Also appears in".
     *
     * ASSERTED AS ONE STRING RATHER THAN PARAMETER BY PARAMETER, because the
     * ORDER is half the rule: ADR-0066 fixes where each sits so that one view
     * of this page has one address, and an assertion that only asked whether
     * each was present would pass against a redirect that re-spelled the lot.
     */
    const refused = await refusedFrom(
      `/items/${curatable.reaching}?${new URLSearchParams(wholeAddress)}`,
    );

    expect(new URL(refused.url).search).toBe(
      "?via=arrived-through-this&placed=narrowed-to-this&after=members-page-two" +
        `&placedAfter=appearances-page-two&refused=${curatable.reaching}&because=cycle&placing=Zoe`,
    );
  });

  it("hands back a STEP BACK in either listing, which the forward cursors do not cover", async () => {
    /*
     * THE OTHER HALF OF BOTH PAIRS (CNCORE-174). `after` and `before` never
     * share a link -- each names where ONE page starts -- so an address
     * carrying the forward pair proves nothing about the backward one, and a
     * form carrying only `after` and `placedAfter` would send a reader who had
     * stepped BACK through either listing to its start on a refusal. Which of
     * each pair the Owner holds is theirs rather than this action's.
     *
     * AND `?placing=` IS ABSENT RATHER THAN EMPTY, which this asserts by
     * asking an address that carries no narrowing: the picker here is the
     * unsearched one, so `inTheFixedOrder` drops the parameter instead of
     * writing a second spelling of this address (ADR-0066).
     */
    const steppedBack = new URLSearchParams({
      before: "members-page-one",
      placedBefore: "appearances-page-one",
    });
    const refused = await refusedFrom(`/items/${curatable.reaching}?${steppedBack}`);

    expect(new URL(refused.url).search).toBe(
      "?before=members-page-one&placedBefore=appearances-page-one" +
        `&refused=${curatable.reaching}&because=cycle`,
    );
  });

  /**
   * WHAT A FORM POSTS BACK TO, as `submit` wants it: the path and the query,
   * without the origin it came back with. `submit` joins what it is given to a
   * base URL, so handing it an absolute one would ask for `http://hosthttp://host/...`.
   */
  function pathOf(url: string): string {
    const landed = new URL(url);
    return `${landed.pathname}${landed.search}`;
  }

  /**
   * The id of the Placement one rendered form names, read off the form itself.
   *
   * FROM THE FORM RATHER THAN FROM THE ADDRESS IT LANDS ON, which is what keeps
   * the assertions below from agreeing with the action by construction: the
   * form is what the page rendered BEFORE the action ran, so an `?undo=` read
   * out of the answer and compared to itself would pass whatever was written.
   */
  function placementNamedBy(form: RenderedForm): string {
    const named = form.fields.find(([name]) => name === "id")?.[1];
    if (named === undefined) throw new Error("that form names no placement");
    return named;
  }

  /** One member of `reaching`, placed and then found by the row it renders as. */
  async function aMemberAt(position: string, at: string) {
    await place(curatable.reaching, { itemId: curatable.beyondThePage, position });
    const { text } = await documentAt(at, owner);
    return rowFor(text, curatable.beyondThePageTitle, `#${position}`);
  }

  it("hands the whole address back from a REMOVAL, with the undo offer appended", async () => {
    /*
     * CNCORE-293, FOLDED IN BECAUSE IT IS ONE REASON TO CHANGE. A removal
     * redirects like the refusal above -- it has to, because with no script an
     * offer can only reach the page through the URL (ADR-0046) -- and it built
     * that address from the two fields its form carried and nothing else. So
     * the most frequent editing act on this page was also the one that moved
     * the reader furthest.
     *
     * `?undo=` LAST, WHICH IS ADR-0066's APPENDING RULE. It was written alone
     * until now, and an address carrying ONE parameter has no order to keep; a
     * second one is what puts it on the fixed list, behind everything already
     * out there.
     *
     * NET ZERO ON THIS ORDERING. The member is placed by this test and removed
     * by it, so what `reaching` holds afterwards is what it held before --
     * which is what keeps this independent of where it is declared in the file.
     */
    const at = `/items/${curatable.reaching}?${new URLSearchParams(wholeAddress)}`;
    const removal = await aMemberAt("600", at);

    const gone = await submit(baseUrl, at, removal, owner);

    expect(new URL(gone.url).search).toBe(
      `?${new URLSearchParams(wholeAddress)}&undo=${placementNamedBy(removal)}`,
    );
  });

  it("hands the whole address back from the UNDO, spending the offer and nothing else", async () => {
    /*
     * THE SECOND HALF, AND THE TWO ARE NOT ONE CHANGE. `restorePlacement`
     * drops `?undo=` on purpose -- the offer is spent, and leaving it on would
     * re-offer an undo of a removal already taken back -- so the question here
     * is whether it drops anything ELSE, which is a different decision wearing
     * the same line of code.
     *
     * FROM THE ADDRESS THE REMOVAL LANDED ON, because that is the only page
     * that renders an Undo at all: with no script the offer lives in the URL.
     */
    const at = `/items/${curatable.reaching}?${new URLSearchParams(wholeAddress)}`;
    const offered = await submit(baseUrl, at, await aMemberAt("601", at), owner);

    const back = await submit(
      baseUrl,
      pathOf(offered.url),
      formIn(offered.text, "place-an-item"),
      owner,
    );

    expect(new URL(back.url).search).toBe(`?${new URLSearchParams(wholeAddress)}`);

    // AND PUT IT BACK, since the undo restored the member this test placed.
    const restored = await documentAt(at, owner);
    await submit(baseUrl, at, rowFor(restored.text, curatable.beyondThePageTitle, "#601"), owner);
  });

  it("keeps a standing undo offer when a LATER placement is refused", async () => {
    /*
     * THE OFFER IS PART OF THE ADDRESS TOO, and it is the one parameter of it
     * that another gesture can destroy outright. A removal leaves the Owner on
     * `?undo=<id>` with BOTH controls on the page: the offer above, and the
     * place form below it. Refuse something from that page and the redirect
     * rebuilds the address -- so an offer it did not carry is an offer gone,
     * for a gesture that never touched the removal.
     *
     * WHICH IS THIS RULE EATING ITS OWN TAIL: `undo` joined the fixed order in
     * this same pass, and the form that had to learn to carry it is the one
     * CNCORE-290 was about. Found by review of that half, against the half
     * filed as CNCORE-293.
     *
     * NET ZERO AGAIN: the member this places is removed by the removal that
     * mints the offer, and the refusal writes nothing.
     */
    const at = `/items/${curatable.reaching}?${new URLSearchParams(wholeAddress)}`;
    const removal = await aMemberAt("602", at);
    const offered = await submit(baseUrl, at, removal, owner);

    const refused = await refusedFrom(pathOf(offered.url));

    expect(new URL(refused.url).search).toBe(
      "?via=arrived-through-this&placed=narrowed-to-this&after=members-page-two" +
        `&placedAfter=appearances-page-two&refused=${curatable.reaching}` +
        `&because=cycle&placing=Zoe&undo=${placementNamedBy(removal)}`,
    );
  });
});

describe("taking a member out again", () => {
  it("removes it from this container, leaves its other placements, and offers an undo", async () => {
    // ADR-0061 and ADR-0046 in one gesture: the member goes from THIS ordering
    // and stays in the other, and what the owner is offered is an undo rather
    // than a confirmation they had to dismiss before the removal happened.
    const inBoth = curatable.otherStory;
    await place(curatable.releaseOrder, { itemId: inBoth, position: "77" });
    await place(curatable.storyOrder, { itemId: inBoth, position: "78" });

    const { text } = await containerPage(curatable.releaseOrder, owner);
    const row = rowFor(text, curatable.otherTitle, "#77");
    const after = await submit(baseUrl, `/items/${curatable.releaseOrder}`, row, owner);

    expect(membersIn(after.text).filter((r) => r.includes("#77"))).toStrictEqual([]);
    expect(after.text).toContain("Removed from this container");

    const storyOrder = await containerPage(curatable.storyOrder, owner);
    expect(membersIn(storyOrder.text).filter((r) => r.includes("#78"))).toHaveLength(1);
  });

  it("undoes the removal, and the member returns with its position and its origin", async () => {
    await place(curatable.storyOrder, { itemId: curatable.story, position: "12" });
    const { text } = await containerPage(curatable.storyOrder, owner);
    const removed = await submit(
      baseUrl,
      `/items/${curatable.storyOrder}`,
      rowFor(text, curatable.storyTitle, "#12"),
      owner,
    );

    const undo = formIn(removed.text, "place-an-item");
    const after = await submit(baseUrl, `/items/${curatable.storyOrder}`, undo, owner);

    // WITH ITS ORIGIN, which is the half a bare "the row is back" would miss:
    // the removal left `placement_sources` standing, so the member returns
    // claimed by the Owner rather than as a claim nobody made (ADR-0017).
    expect(membersIn(after.text).filter((r) => r.includes("#12"))).toStrictEqual([
      expect.stringContaining("Owner"),
    ]);
  });
});

describe("what a visitor is shown", () => {
  it("offers a visitor no way to change what a container holds", async () => {
    // ADR-0044 makes the demo READ-ONLY, and this asserts it about the PAGE
    // rather than about the router underneath it: a visitor is shown the whole
    // ordering and no control that would change it.
    await place(curatable.releaseOrder, { itemId: curatable.story, position: "55" });

    const { text } = await documentAt(`/items/${curatable.releaseOrder}`);

    expect(text).toContain(curatable.storyTitle);
    expect(() => sectionIn(text, "place-an-item")).toThrow();
    expect(membersIn(text).join(" ")).not.toContain("Remove");
  });
});
