import { describe, expect, it } from "vitest";

import { cmppRecord } from "./index";

/** A record that parses, so a case below differs from it in exactly one field. */
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
 * A record's `url` is a CONTENT URL, so the scheme is judged where the record is
 * read rather than where something might later fetch it.
 *
 * THE FOUR CASES ARE THE ONES THAT ACTUALLY GOT THROUGH, measured against the
 * installed zod rather than reasoned about: `z.url()` checks that a string
 * parses as a URL and says nothing about its scheme, so all four of these
 * parsed clean. One representative of them would not be the same test -- each
 * is a different sink (`javascript:` and `vbscript:` execute, `data:` carries a
 * document with its own origin, `file:` reads the reader's disk), and a rule
 * written against one of them can miss the others.
 */
describe("a record's url", () => {
  it.each([
    ["javascript:alert(1)", "it runs script in the reader's browser"],
    ["data:text/html,<script>x</script>", "it is a document with its own origin"],
    ["vbscript:x", "it runs script too, on the browsers that still read it"],
    ["file:///etc/passwd", "it reads the reader's own disk"],
  ])("refuses %s, because %s", (url) => {
    expect(cmppRecord.safeParse({ ...A_RECORD, url }).success).toBe(false);
  });

  /**
   * THE HALF THAT STOPS THE RULE BEING "REFUSE EVERYTHING", which the cases
   * above cannot tell apart from the rule we want.
   *
   * The loopback case is the one worth naming: it is a self-link from a
   * provider the owner runs on their own machine, and ADR-0034 makes such a
   * provider legal BY NAME. The address deny-list this package also carries
   * would refuse it, which is why the scheme is judged here and the address is
   * judged in front of a socket -- nothing fetches this URL.
   */
  it.each([
    ["https://tardis.wiki/wiki/The_Tenth_Planet", "the ordinary case"],
    ["http://example.invalid/265", "HTTP, because a provider on a LAN has no certificate"],
    ["HTTPS://Example.Invalid/265", "a scheme is case-insensitive, so this is the same scheme"],
    ["http://127.0.0.1:8080/265", "a provider the owner runs on loopback, linking to itself"],
  ])("admits %s: %s", (url) => {
    expect(cmppRecord.safeParse({ ...A_RECORD, url }).success).toBe(true);
  });
});
