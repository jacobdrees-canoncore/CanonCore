import { describe, expect, inject, it } from "vitest";

import { clientAt, documentAt } from "./document";

const { throughAnInfobox } = inject("browsed");

/**
 * THE PREFIXES OF A SOURCE'S NON-CONTENT NAMESPACES, which title how a source is
 * organised rather than anything in it. The wiki's `Template:` first, since an
 * entity infobox is what an import browses through (CNCORE-432); a page in one
 * is how members were reached, never an ordering a reader would recognise.
 */
const NON_CONTENT = /^Template:/;

/**
 * Every Row the Listings hold, walked page by page by the id each page ended
 * on (ADR-0119), as a reader paging to the end would meet them.
 */
async function everyRow(listing: "list" | "works" = "list") {
  const client = clientAt(inject("baseUrl"));
  const rows = [];
  let after: string | undefined;
  for (;;) {
    const page = await client.catalogue[listing]({ limit: 100, after });
    rows.push(...page.rows);
    if (page.rows.length < 100) return rows;
    after = page.rows.at(-1)?.id;
  }
}

describe("a page a browse reached its members through (CNCORE-432)", () => {
  it("is stored as no Container at all", () => {
    expect(throughAnInfobox.containerId).toBeNull();
  });

  it("titles no Container a reader sees, as a Row or as where a Row appears", async () => {
    const rows = [...(await everyRow()), ...(await everyRow("works"))];
    // A GREEN THAT MEANS SOMETHING: the walk met Containers, and one of the
    // infobox's pages, so the guard below ran over the catalogue it guards.
    expect(rows.filter((row) => row.isContainer).length).toBeGreaterThan(0);
    expect(rows.map((row) => row.title)).toContain(throughAnInfobox.member);

    const containers = [
      ...rows.filter((row) => row.isContainer).map((row) => row.title),
      ...rows.flatMap((row) => row.sitsIn.first.map((placement) => placement.containerTitle)),
    ];
    expect(containers.filter((title) => NON_CONTENT.test(title ?? ""))).toEqual([]);
  });

  it("leaves each of its pages in no ordering, on the Listings and on the page itself", async () => {
    const listed = await documentAt(`/?kind=time_span`);
    expect(listed.text).toContain(throughAnInfobox.member);
    expect(listed.text).not.toContain(throughAnInfobox.title);
    // ITS OWN ROW SAYS SO, in the words a Row with no Placement uses: the text
    // from its title up to the next Row's link is that Row.
    const row = listed.text.split(throughAnInfobox.member)[1]?.split('href="/items/')[0];
    expect(row).toContain("In no ordering");

    const rows = await everyRow();
    const member = rows.find((row) => row.title === throughAnInfobox.member);
    if (member === undefined) throw new Error(`no Row is titled ${throughAnInfobox.member}`);
    expect(member.sitsIn.total).toBe(0);

    const page = await documentAt(`/items/${member.id}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain(throughAnInfobox.member);
    expect(page.text).not.toContain("Also appears in");
    expect(page.text).not.toContain(throughAnInfobox.title);
  });

  it("is not a result a search can reach", async () => {
    const { text } = await documentAt(
      `/search?q=${encodeURIComponent("Infobox Event or Conflict")}`,
    );
    expect(text).not.toContain(throughAnInfobox.title);
  });
});
