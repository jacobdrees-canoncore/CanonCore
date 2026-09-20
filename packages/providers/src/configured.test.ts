import { describe, expect, it } from "vitest";

import {
  nameProvider,
  OutboundRefused,
  ProviderNotNamed,
  parseProviderUrls,
  removeProvider,
} from "./index";

/**
 * THE REFUSAL A CALL RAISED, so a test can read WHICH refusal it was rather
 * than only that there was one.
 *
 * `toThrow` MATCHES A CLASS OR A MESSAGE AND NEITHER IS THE QUESTION HERE
 * (CNCORE-262). Three of this file's refusals are the same class, and matching
 * on the SENTENCE would pin the wording of a message the settings surface is
 * specifically not allowed to render -- the page owns those words, and a test
 * asserting them here would make the sentence two files' to change.
 */
function refusalFrom(run: () => unknown): ProviderNotNamed {
  try {
    run();
  } catch (cause) {
    if (cause instanceof ProviderNotNamed) return cause;
    throw cause;
  }
  throw new Error("nothing was refused, and something should have been");
}

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
   * WHERE THE VALUE IS PARSED RATHER THAN WHERE IT IS USED, which is the lesson
   * `createContext` already carries about `parseAllowlist`: a typo caught at the
   * parse is one an owner is told about, and a typo caught where the value is
   * USED turns a read path into 500s. The settings surface is what that parse
   * now stands in front of (CNCORE-99): `settings.nameProvider` refuses an entry
   * here, so no value that cannot be read reaches a row.
   */
  it("refuses an entry that is not a URL at all", () => {
    expect(() => parseProviderUrls("http://wiki.test:8080, wiki.test")).toThrow(OutboundRefused);
  });
});

/**
 * NAMING A PROVIDER, which is what the owner does on the settings surface
 * (CNCORE-99) and what an environment variable used to be edited for.
 *
 * A PURE FUNCTION OVER THE CONFIGURED STRING, taking one and answering the
 * next. The settings store holds a string (`@canoncore/db`), the router reads
 * it and writes back what this answers, and nothing about an entry's meaning
 * moved with the source (ADR-0121).
 */
describe("nameProvider", () => {
  it("names a provider on an instance that had none", () => {
    expect(nameProvider("", "http://wiki.test:8080")).toBe("http://wiki.test:8080");
  });

  it("keeps the providers already named, exactly as they were written", () => {
    // THE OTHER ENTRIES COME BACK UNTOUCHED, spelling included: adding one
    // provider is not an occasion to rewrite another's identity (ADR-0031).
    expect(
      parseProviderUrls(nameProvider("http://Wiki.Test:8080/base", "http://tmdb.test:8080")),
    ).toEqual(["http://Wiki.Test:8080/base", "http://tmdb.test:8080"]);
  });

  /**
   * ONE RULE, IN THE PLACE IT ALREADY LIVES. `parseProviderUrls` is what decides
   * whether an entry is a URL, and naming one asks the same question -- a second
   * check here would be a second rule, free to drift from the one every read
   * goes through.
   */
  it("refuses an entry that is not a URL", () => {
    expect(() => nameProvider("", "wiki.test")).toThrow(OutboundRefused);
  });

  /**
   * A BOX OF SPACES NAMED NOTHING, AND THAT IS NOT THE SAME MISTAKE AS NAMING
   * TWO (CNCORE-262). One `if` answered both -- `entry === undefined` and
   * `rest.length > 0` raised the identical sentence -- so an Owner who
   * submitted an empty box was told to "name them one at a time", which is
   * advice about a mistake they did not make.
   *
   * `parseProviderUrls` SPLITS WHITESPACE AWAY, so a run of spaces is no
   * entries at all: the absence an empty box is, wearing another spelling.
   * That is `oneValue`'s own reading of a blank parameter, one layer down.
   */
  it("says a blank entry named NOTHING, rather than that it was several", () => {
    expect(refusalFrom(() => nameProvider("", "   ")).why).toBe("nothing-named");
  });

  /**
   * A PROVIDER NAMED TWICE IS SEARCHED TWICE, which is a catalogue asking one
   * source the same question twice and reading two answers from it. The owner
   * typed a provider they already have; the configuration they meant is the one
   * they already have.
   */
  it("does not name a provider twice", () => {
    expect(nameProvider("http://wiki.test:8080", "http://wiki.test:8080")).toBe(
      "http://wiki.test:8080",
    );
  });

  /**
   * AND TWO SPELLINGS ARE TWO PROVIDERS, deliberately. `http://wiki.test:8080`
   * and `http://wiki.test:8080/` are one host to a person and two identities to
   * this catalogue (ADR-0031), so nothing here quietly treats them as one --
   * the repeat above is an EXACT repeat, because an identity is exact.
   */
  it("treats a different spelling as a different provider", () => {
    expect(
      parseProviderUrls(nameProvider("http://wiki.test:8080", "http://wiki.test:8080/")),
    ).toEqual(["http://wiki.test:8080", "http://wiki.test:8080/"]);
  });
});

/**
 * REMOVING A PROVIDER, which stops this instance consulting a source (CNCORE-99).
 *
 * NOT A PURGE, and the words are kept apart on purpose (`CONTEXT.md`). A purge
 * removes everything one source ever contributed; this removes the source from
 * the list of places to ask, and every claim it ever made stays exactly where it
 * is.
 */
describe("removeProvider", () => {
  it("takes the one named and leaves the others as they were written", () => {
    const configured = "http://Wiki.Test:8080/base\nhttp://tmdb.test:8080";

    expect(parseProviderUrls(removeProvider(configured, "http://tmdb.test:8080"))).toEqual([
      "http://Wiki.Test:8080/base",
    ]);
  });

  it("leaves an instance naming nothing when its last provider goes", () => {
    // THE EMPTY STRING IS A CONFIGURATION, not a missing one: it is what an
    // instance that reaches no provider is set to, and what the import surface
    // already says "none" to rather than showing an empty result (ADR-0094).
    expect(removeProvider("http://wiki.test:8080", "http://wiki.test:8080")).toBe("");
  });

  /**
   * A PROVIDER THAT IS NOT NAMED IS ALREADY REMOVED. The owner's intent is
   * satisfied by the configuration they already have, and refusing here would
   * make a second click on a Remove button an error rather than a no-op.
   */
  it("changes nothing when the provider was never named", () => {
    const configured = "http://wiki.test:8080";
    expect(removeProvider(configured, "http://tmdb.test:8080")).toBe(configured);
  });

  /**
   * AN EXACT MATCH, for the reason naming is exact: two spellings of one host
   * are two identities (ADR-0031), and removing a provider the owner did not
   * name would be this app deciding which of them they meant.
   */
  it("does not take a different spelling of the same host", () => {
    expect(
      parseProviderUrls(removeProvider("http://wiki.test:8080", "http://wiki.test:8080/")),
    ).toEqual(["http://wiki.test:8080"]);
  });
});
