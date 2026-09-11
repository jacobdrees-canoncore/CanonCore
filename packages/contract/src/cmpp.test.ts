import { describe, expect, it } from "vitest";

import { record } from "./cmpp";

/**
 * WHAT THE SPECIFICATION REFUSES, asserted against the specification itself.
 *
 * The suite next door holds real providers to this shape over HTTP, and it
 * cannot prove this half: no provider under test sends a `javascript:` URL, so
 * an assertion that only watched their traffic would pass forever without the
 * rule existing. What obliges a provider is what this document says, so this is
 * where the obligation is checked.
 */

/** A record that satisfies the contract, so a case below differs in one field. */
const A_RECORD = {
  id: "265",
  title: "The Tenth Planet",
  kind: "TV story",
  released: ["1966-10-08"],
  writers: ["Kit Pedler"],
  series: null,
  url: "https://example.invalid/265",
};

/**
 * THE FOUR SCHEMES THAT ACTUALLY GOT THROUGH, measured against zod 4.5.4 rather
 * than reasoned about: `z.url()` asks whether a string parses as a URL and says
 * nothing about its scheme, so each of these parsed clean.
 *
 * FOUR RATHER THAN ONE REPRESENTATIVE, because they are four different sinks --
 * `javascript:` and `vbscript:` execute, `data:` carries a document with its own
 * origin, `file:` reads the reader's own disk -- and a rule written against one
 * of them can miss the others.
 */
const NOT_HTTP = [
  "javascript:alert(1)",
  "data:text/html,<script>x</script>",
  "vbscript:x",
  "file:///etc/passwd",
];

describe("the contract's record url", () => {
  it.each(NOT_HTTP)("refuses %s, so a provider may not send one", (url) => {
    expect(record.safeParse({ ...A_RECORD, url }).success).toBe(false);
  });

  /**
   * THE HALF THAT STOPS THE RULE BEING "REFUSE EVERYTHING", which the cases
   * above cannot tell apart from the rule the contract wants.
   *
   * The loopback case is the one worth naming. The contract is the INTERSECTION
   * every provider must satisfy, and a provider its owner runs on their own
   * machine is legal by name under ADR-0034 -- so a self-link from one is a
   * conformant value, and a rule that refused it would be the contract quietly
   * requiring a public domain.
   */
  it.each([
    ["https://tardis.wiki/wiki/The_Tenth_Planet", "the ordinary case"],
    ["http://example.invalid/265", "HTTP, because a provider on a LAN has no certificate"],
    ["HTTPS://Example.Invalid/265", "a scheme is case-insensitive, so this is the same scheme"],
    ["http://127.0.0.1:8080/265", "a provider the owner runs on loopback, linking to itself"],
  ])("admits %s: %s", (url) => {
    expect(record.safeParse({ ...A_RECORD, url }).success).toBe(true);
  });
});

/**
 * AN IMAGE REFERENCE CARRIES TWO URLS, and both reach a reader.
 *
 * `url` is where the BYTES are, which ADR-0037's store is filled from, so a
 * non-HTTP one is a value the fetcher is handed. `description_url` is the
 * source's own page for the file, which is rendered as a LINK beside the credit
 * -- the same sink a record's `url` is, one field along. Checking the first and
 * not the second would leave the rule true of the half nobody clicks.
 */
describe("the contract's image urls", () => {
  const anImage = { role: "poster", url: "https://example.invalid/poster.jpg" };

  it.each(NOT_HTTP)("refuses %s where the bytes are", (url) => {
    const images = [{ ...anImage, url }];
    expect(record.safeParse({ ...A_RECORD, images }).success).toBe(false);
  });

  it.each(NOT_HTTP)("refuses %s as the page describing the file", (description_url) => {
    const images = [{ ...anImage, description_url }];
    expect(record.safeParse({ ...A_RECORD, images }).success).toBe(false);
  });

  /**
   * `description_url` IS NULLABLE AND OPTIONAL, and the scheme rule must not
   * have quietly taken that away: TMDB serves no file description pages, so a
   * provider that omits it or sends `null` is conformant and has to stay so.
   */
  it("still lets a source say it has no description page", () => {
    const omitted = record.safeParse({ ...A_RECORD, images: [anImage] });
    const explicit = record.safeParse({
      ...A_RECORD,
      images: [{ ...anImage, description_url: null }],
    });

    expect(omitted.success).toBe(true);
    expect(explicit.success).toBe(true);
  });
});
