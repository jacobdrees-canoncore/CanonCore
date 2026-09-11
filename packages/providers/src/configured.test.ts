import { describe, expect, it } from "vitest";

import { OutboundRefused, parseProviderUrls } from "./index";

/**
 * WHICH PROVIDERS THIS INSTANCE SEARCHES, read out of one configured string.
 *
 * ADR-0031 makes a provider a URL and nothing more, so there is no registry to
 * consult: the set has to come from somewhere the owner writes it, and this is
 * the reading of that.
 */
describe("parseProviderUrls", () => {
  it("reads several providers out of one configured string", () => {
    expect(parseProviderUrls("http://wiki.test:8080, http://tmdb.test:8080")).toEqual([
      "http://wiki.test:8080",
      "http://tmdb.test:8080",
    ]);
  });

  /**
   * AT MODULE LOAD RATHER THAN AT THE FIRST SEARCH, which is the lesson
   * `createContext` already carries about `parseAllowlist`: a typo caught where
   * the value is parsed stops the server starting, and a typo caught where the
   * value is USED turns a read path into 500s.
   */
  it("refuses an entry that is not a URL at all", () => {
    expect(() => parseProviderUrls("http://wiki.test:8080, wiki.test")).toThrow(OutboundRefused);
  });
});
