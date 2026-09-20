import { describe, expect, it } from "vitest";
// NOT FROM `./index`, WHERE ITS SIBLINGS BELOW COME FROM. `shortly` is
// deliberately absent from that enumeration -- a symbol is public there because
// a line was written for it -- and nothing outside this package calls it. Do not
// "fix" this by exporting it.
import { shortly } from "./boundary";
import {
  allowsAnything,
  assertConfigAddresses,
  assertConfigUrl,
  assertContentAddress,
  assertContentAddresses,
  assertContentUrl,
  OutboundRefused,
  parseAllowlist,
  pinnedLookup,
  reasonFor,
} from "./index";

/**
 * ADR-0034's CONTENT boundary: an address reached because something in a
 * provider's response or a redirect named it.
 *
 * The cases are the record's own. Each one is a way an enumerated CIDR list
 * gets it wrong, which is why the rule is a classification instead.
 */
describe("a content address", () => {
  it("admits an ordinary public address, v4 and v6", () => {
    expect(() => assertContentAddress("8.8.8.8")).not.toThrow();
    expect(() => assertContentAddress("2606:4700:4700::1111")).not.toThrow();
  });

  it.each([
    // The cloud metadata endpoint the whole boundary exists for.
    ["169.254.169.254", "linkLocal"],
    // ADR-0034: AWS and GCP publish these, and OWASP's own IPv6 table lists
    // only ::1/128 and ff00::/8, so a list built from it admits both.
    ["fd00:ec2::254", "uniqueLocal"],
    ["fd20:ce::254", "uniqueLocal"],
    // Tailscale. Refused in content on purpose: response content is untrusted
    // whatever network it names, and a provider ON a tailnet is a config URL.
    ["100.64.0.1", "carrierGradeNat"],
    // Loopback is not exempt either, which is the half that makes the
    // allowlist load-bearing rather than decorative.
    ["127.0.0.1", "loopback"],
    ["::1", "loopback"],
    ["192.168.1.10", "private"],
    // IANA's registry does not hold multicast at all, so "globally reachable
    // is False" never sees this one.
    ["224.0.0.1", "multicast"],
    // Empty globally-reachable value in the registry, so an equality test
    // misses it.
    ["192.88.99.1", "reserved"],
    // Globally reachable TRUE in the registry, so that rule would ADMIT it.
    ["192.0.0.9", "reserved"],
    ["::ffff:127.0.0.1", "ipv4Mapped"],
    ["0.0.0.0", "unspecified"],
  ])("refuses %s, which is %s", (address, range) => {
    expect(() => assertContentAddress(address)).toThrow(OutboundRefused);
    expect(() => assertContentAddress(address)).toThrow(range);
  });

  /**
   * The refusal names the LIBRARY whose vocabulary it is using. IANA has no
   * `unicast` classification -- its registry classifies by Source, Destination,
   * Forwardable, Globally Reachable and Reserved-by-Protocol -- and an earlier
   * version of ADR-0034 attributed the word to it. The next reader goes looking
   * for the term in whatever the message names, so the message must not send
   * them to the registry.
   */
  it("names ipaddr.js as the vocabulary, never IANA", () => {
    const refusal = (() => {
      try {
        assertContentAddress("169.254.169.254");
      } catch (error) {
        return error as OutboundRefused;
      }
      throw new Error("expected a refusal");
    })();

    expect(refusal.message).toContain("ipaddr.js");
    expect(refusal.message).not.toContain("IANA");
  });

  /**
   * A string that is not an address at all is refused rather than parsed
   * leniently: it reaches here from a redirect header, which is attacker-shaped
   * input, and "could not read it" must never mean "carry on".
   */
  it("refuses a string that is not an address", () => {
    expect(() => assertContentAddress("not-an-address")).toThrow(OutboundRefused);
  });
});

/**
 * ADR-0034's CONFIG boundary: a URL the OWNER typed into settings, which is
 * OWASP's Case 1 -- an identified and trusted destination -- and therefore an
 * ALLOWLIST rather than a deny-list.
 *
 * This is the half that makes a local or tailnet provider legal BY NAME. The
 * content rule above refuses `loopback` and `carrierGradeNat`, and that stays
 * true; the allowlist is a different question asked of a different kind of URL,
 * not an exception carved into the deny rule.
 */
describe("a config URL", () => {
  it("admits a loopback base URL when a CIDR covering it is allowlisted", () => {
    const allowlist = parseAllowlist("127.0.0.0/8");
    expect(() => assertConfigUrl(new URL("http://127.0.0.1:8080/"), allowlist)).not.toThrow();
  });

  it("admits a tailnet base URL when its CIDR is allowlisted", () => {
    const allowlist = parseAllowlist("100.64.0.0/10");
    expect(() => assertConfigUrl(new URL("http://100.100.20.3/"), allowlist)).not.toThrow();
  });

  it("admits a host named exactly, and refuses its neighbours", () => {
    const allowlist = parseAllowlist("wiki.example.com");
    expect(() => assertConfigUrl(new URL("https://wiki.example.com/"), allowlist)).not.toThrow();
    expect(() => assertConfigUrl(new URL("https://evil.example.com/"), allowlist)).toThrow(
      OutboundRefused,
    );
    // A SUFFIX IS NOT A MATCH. `evilwiki.example.com` ends with the allowlisted
    // string, and a `endsWith` implementation admits it.
    expect(() => assertConfigUrl(new URL("https://evilwiki.example.com/"), allowlist)).toThrow(
      OutboundRefused,
    );
  });

  it("refuses everything when nothing is allowlisted", () => {
    const allowlist = parseAllowlist("");
    expect(() => assertConfigUrl(new URL("https://wiki.example.com/"), allowlist)).toThrow(
      OutboundRefused,
    );
    expect(() => assertConfigUrl(new URL("http://127.0.0.1:8080/"), allowlist)).toThrow(
      OutboundRefused,
    );
  });

  /**
   * "Exact hosts and CIDRs WITH NO WILDCARDS" is ADR-0034's phrasing, so a
   * wildcard is a malformed entry rather than a literal hostname that happens
   * to match nothing. Refusing it at parse time is what tells the owner their
   * settings do not do what they think; treating it as a literal would leave
   * them believing a whole domain was reachable when none of it was.
   */
  it("refuses a wildcard entry rather than reading it as a literal host", () => {
    expect(() => parseAllowlist("*.example.com")).toThrow(OutboundRefused);
  });

  it("reads several entries, separated by commas and whitespace", () => {
    const allowlist = parseAllowlist(" 127.0.0.0/8 , wiki.example.com ");
    expect(() => assertConfigUrl(new URL("http://127.0.0.1:8080/"), allowlist)).not.toThrow();
    expect(() => assertConfigUrl(new URL("https://wiki.example.com/"), allowlist)).not.toThrow();
  });

  /**
   * A HOSTNAME ENTRY DOES NOT ADMIT AN ADDRESS, and an address entry does not
   * admit a hostname. They are matched as the different things they are, so
   * nothing resolves at this stage and nobody can smuggle one past the other.
   */
  it("does not let a hostname entry admit a literal address", () => {
    const allowlist = parseAllowlist("wiki.example.com");
    expect(() => assertConfigUrl(new URL("http://169.254.169.254/"), allowlist)).toThrow(
      OutboundRefused,
    );
  });

  /**
   * THE SAME MISLEADING REMEDY SAT ON THIS SENTENCE TOO (CNCORE-244). The
   * ticket names the ADDRESS check, and this one carried the identical closing
   * clause -- so correcting only the refusal it named would have left the old
   * claim standing in the function next door.
   *
   * THERE IS NO HOST HALF TO NAME HERE, which is why the sentence is not the
   * same one. `parseAllowlist` files a bare address under RANGES, and this
   * branch never consults the hostname set at all, so a CIDR is the whole
   * remedy rather than the missing half of one.
   */
  it("offers a CIDR that admits it, for a base URL whose host IS an address", () => {
    const allowlist = parseAllowlist("provider-wiki");

    const refusal = refusalFrom(() =>
      assertConfigUrl(new URL("http://172.19.0.3:8080/"), allowlist),
    );

    expect(refusal).toContain("`172.19.0.3/32`");
    expect(admitsAfterAllowlisting(cidrQuotedIn(refusal), "172.19.0.3")).toBe(true);
    // ADR-0123's ceiling, with the Owner's own origin in the sentence as well.
    expect(refusal.length).toBeLessThanOrEqual(300);
    // AND NOT THE CLAUSE THAT SENT A FIRST-TIME OWNER TO ALLOWLIST A NAME.
    expect(refusal).not.toContain("goes on the allowlist by name");
  });

  it("matches an IPv6 host inside an allowlisted IPv6 CIDR", () => {
    const allowlist = parseAllowlist("fd00::/8");
    expect(() => assertConfigUrl(new URL("http://[fd00:ec2::254]/"), allowlist)).not.toThrow();
    expect(() => assertConfigUrl(new URL("http://[2606:4700::1111]/"), allowlist)).toThrow(
      OutboundRefused,
    );
  });
});

/**
 * ADR-0034: both boundaries resolve the hostname once and PIN THE CONNECTION to
 * the resolved address, because re-validating at each redirect hop does not stop
 * a host that resolves differently on the second lookup.
 *
 * It is done through the CLIENT'S DNS `lookup` HOOK and never by rewriting the
 * URL's host to an IP. Node's own TLS documentation says `servername` "must be a
 * host name, and not an IP address", so the rewrite silently drops SNI and
 * degrades certificate validation while continuing to look like it works.
 */
describe("the pinning lookup hook", () => {
  const refuseNothing = () => {};
  const records = (...addresses: string[]) =>
    addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));

  const run = (lookup: ReturnType<typeof pinnedLookup>, options: object) =>
    new Promise<{ error: Error | null; result: unknown }>((resolve) => {
      // The hook's third argument is a Node-style callback, so a refusal must
      // arrive THERE. A hook that threw synchronously would escape the
      // connector rather than failing the request it belongs to.
      lookup("provider.example.com", options, (error: Error | null, ...rest: unknown[]) =>
        resolve({ error, result: rest }),
      );
    });

  /**
   * THE CENTRAL CASE. Node's `autoSelectFamily` now defaults to true --
   * `net.getDefaultAutoSelectFamily()` is `true` on the Node this repo pins --
   * so the socket tries EVERY address it is handed, in sequence, until one
   * connects. Validating only the first hands the connector an address nobody
   * checked and lets it be the one that answers.
   */
  it("refuses when a later record fails, not only the first", async () => {
    const lookup = pinnedLookup(assertContentAddresses, async () =>
      records("93.184.216.34", "169.254.169.254"),
    );

    const { error } = await run(lookup, { all: true });

    expect(error).toBeInstanceOf(OutboundRefused);
    expect(error?.message).toContain("169.254.169.254");
  });

  it("refuses when a later AAAA record fails behind a good A record", async () => {
    const lookup = pinnedLookup(assertContentAddresses, async () =>
      records("93.184.216.34", "fd00:ec2::254"),
    );

    const { error } = await run(lookup, { all: true });

    expect(error).toBeInstanceOf(OutboundRefused);
    expect(error?.message).toContain("uniqueLocal");
  });

  /**
   * A caller that asked for ONE address still gets every record checked. `all`
   * describes the shape of the ANSWER, never how much of the resolution is
   * trusted -- reading it as the latter is the same hole as checking only the
   * first record, arriving through a different door.
   */
  it("checks every record even when the caller asked for a single address", async () => {
    const lookup = pinnedLookup(assertContentAddresses, async () =>
      records("93.184.216.34", "169.254.169.254"),
    );

    const { error } = await run(lookup, { all: false });

    expect(error).toBeInstanceOf(OutboundRefused);
  });

  it("answers with every record when the caller asked for all of them", async () => {
    const lookup = pinnedLookup(refuseNothing, async () =>
      records("93.184.216.34", "2606:4700::1111"),
    );

    const { error, result } = await run(lookup, { all: true });

    expect(error).toBeNull();
    expect(result).toEqual([
      [
        { address: "93.184.216.34", family: 4 },
        { address: "2606:4700::1111", family: 6 },
      ],
    ]);
  });

  /**
   * The single-address form is `(err, address, family)` -- two arguments after
   * the error, not one object. Handing back the array shape here is a mismatch
   * the connector does not report; it simply fails to connect.
   */
  it("answers with one address and its family when the caller asked for one", async () => {
    const lookup = pinnedLookup(refuseNothing, async () => records("93.184.216.34"));

    const { error, result } = await run(lookup, {});

    expect(error).toBeNull();
    expect(result).toEqual(["93.184.216.34", 4]);
  });

  /**
   * THE HOOK IS WHERE CNCORE-287'S DEFECT LIVED, and this is it at the seam the
   * Owner's connection actually goes through. `localhost` answers with `::1`
   * AND `127.0.0.1` -- measured on this machine, in that order -- and the loop
   * that used to stand here could only ever report the first, so allowlisting
   * what the refusal said produced the same sentence about the other address.
   *
   * ONE REFUSAL, BOTH CIDRS: the whole list reaches the rule that writes the
   * remedy, which is the contract change this ticket is.
   */
  it("hands a dual-stack host's whole answer to the boundary, in one refusal", async () => {
    const lookup = pinnedLookup(assertConfigAddresses(parseAllowlist("localhost")), async () =>
      records("::1", "127.0.0.1"),
    );

    const { error } = await run(lookup, { all: true });

    expect(error).toBeInstanceOf(OutboundRefused);
    expect(error?.message).toContain("::1/128");
    expect(error?.message).toContain("127.0.0.1/32");
  });

  /**
   * AND THE CONTENT BOUNDARY KEEPS ITS OWN RULE ACROSS THE SAME CONTRACT
   * (ADR-0034). The type both hooks take is shared; the rules are not. A
   * content hop's list must never be judged against the allowlist, or an
   * address the Owner named for their PROVIDER would become reachable from
   * anything a provider's response points at -- which is the split this record
   * exists to hold.
   */
  it("still refuses a content hop the allowlist would have admitted", async () => {
    const allowlisted = parseAllowlist("127.0.0.0/8");
    const answer = async () => records("127.0.0.1");

    const config = pinnedLookup(assertConfigAddresses(allowlisted), answer);
    const content = pinnedLookup(assertContentAddresses, answer);

    expect((await run(config, { all: true })).error).toBeNull();
    expect((await run(content, { all: true })).error).toBeInstanceOf(OutboundRefused);
  });

  it("reports a hostname that resolves to nothing rather than answering empty", async () => {
    const lookup = pinnedLookup(refuseNothing, async () => []);

    const { error } = await run(lookup, { all: true });

    expect(error).toBeInstanceOf(OutboundRefused);
  });

  /**
   * A resolver failure is the caller's to see as itself. Turning a DNS error
   * into a refusal would report "this address is not allowed" about a host that
   * has no address at all.
   */
  it("passes a resolver failure through unchanged", async () => {
    const boom = new Error("ENOTFOUND");
    const lookup = pinnedLookup(refuseNothing, async () => {
      throw boom;
    });

    const { error } = await run(lookup, { all: true });

    expect(error).toBe(boom);
  });
});

/**
 * The CONFIG boundary's address half, which is what the pinning hook enforces
 * once a base URL's host has already passed the allowlist.
 *
 * The host check alone is not enough: an allowlisted HOSTNAME still resolves
 * through DNS somebody else controls, so `wiki.example.com` pointing at
 * 169.254.169.254 has to fail somewhere. This is that somewhere.
 */
describe("a config address", () => {
  it("admits an ordinary public address", () => {
    const assert = assertConfigAddresses(parseAllowlist("wiki.example.com"));
    expect(() => assert(["93.184.216.34"])).not.toThrow();
  });

  /**
   * The whole reason a base URL gets an allowlist instead of the deny rule.
   * Loopback and Tailscale are refused in CONTENT and reachable HERE, and only
   * because the owner named the range.
   */
  it("admits an address the owner allowlisted by CIDR, even though content refuses it", () => {
    const assert = assertConfigAddresses(parseAllowlist("127.0.0.0/8, 100.64.0.0/10"));

    expect(() => assert(["127.0.0.1"])).not.toThrow();
    expect(() => assert(["100.100.20.3"])).not.toThrow();
    // The same two addresses, through the content rule, are still refused.
    expect(() => assertContentAddress("127.0.0.1")).toThrow(OutboundRefused);
    expect(() => assertContentAddress("100.100.20.3")).toThrow(OutboundRefused);
  });

  /**
   * AN ALLOWLISTED HOSTNAME IS NOT A BLANK CHEQUE. This is DNS rebinding: the
   * name is one the owner trusts and the answer is not, and the answer is what
   * the socket connects to.
   */
  it("refuses an allowlisted host that resolves somewhere the owner never named", () => {
    const assert = assertConfigAddresses(parseAllowlist("wiki.example.com"));

    expect(() => assert(["169.254.169.254"])).toThrow(OutboundRefused);
    expect(() => assert(["127.0.0.1"])).toThrow(OutboundRefused);
  });

  /**
   * THE REMEDY A REFUSAL NAMES HAS TO BE ONE THE OWNER CAN CARRY OUT
   * (CNCORE-244). This sentence used to end "a provider on a private network
   * goes on the allowlist by name (ADR-0034)", which a first-time Owner reads
   * as "put the host's name on the allowlist" -- and that is the one thing
   * which cannot work, because this check exists precisely so that a name never
   * admits a private address.
   *
   * MEASURED ON A BLANK INSTANCE, 2026-09-20: an allowlist of `provider-wiki`
   * was refused with that sentence, and `provider-wiki, 172.19.0.0/16` imported
   * 465 Containers. The Owner's own install carries both entries, which is why
   * the defect survived until a first-run walk reached it.
   *
   * SO THE SENTENCE NAMES BOTH HALVES, and it can: reaching here means the HOST
   * half already passed, because `assertConfigUrl` refuses an unallowlisted
   * host before any socket is opened. What is missing is always the CIDR.
   */
  it("names both halves and quotes a CIDR that admits the address it refused", () => {
    const assert = assertConfigAddresses(parseAllowlist("provider-wiki"));

    const refusal = refusalFrom(() => assert(["172.19.0.3"]));

    // THE HALF ALREADY DONE, said so the Owner does not go and do it again.
    expect(refusal).toContain("Its host is allowlisted");
    // THE HALF THAT IS MISSING, as something to copy rather than to compose.
    expect(refusal).toContain("`172.19.0.3/32`");
    // AND THE QUOTED RANGE REALLY ADMITS THE REFUSED ADDRESS ONCE ALLOWLISTED,
    // which is the promise the sentence makes and the one the old one broke.
    expect(admitsAfterAllowlisting(cidrQuotedIn(refusal), "172.19.0.3")).toBe(true);
    // AND IT NO LONGER INVITES THE ONE THING THAT CANNOT WORK.
    expect(refusal).not.toContain("goes on the allowlist by name");
  });

  /**
   * ADR-0123'S CEILING, ASSERTED AT FULL STRETCH RATHER THAN ON THE FIXED PROSE.
   * That record's own lesson is that a refusal assembled from a value of any
   * length is not BOUNDED by the 300-character cap but TRUNCATED by it, and
   * what gets truncated is the END -- the clause naming the remedy. This
   * sentence now carries THREE values, so it is the one most able to overrun.
   *
   * THE WORST CASE IS MEASURED, NOT IMAGINED. `2001:30::/28` is ipaddr.js
   * 2.5.0's `droneRemoteIdProtocolEntityTags`, the longest range name it can
   * return at 31 characters, and an address filling that prefix renders at its
   * longest too. Read off the library's own `SpecialRanges` table rather than
   * recalled.
   */
  it("stays inside ADR-0123's 300 characters with every value at full stretch", () => {
    const assert = assertConfigAddresses(parseAllowlist("provider-wiki"));

    const refusal = refusalFrom(() => assert(["2001:3f:ffff:ffff:ffff:ffff:ffff:ffff"]));

    // 300 written out, so ADR-0123's constant cannot assert itself.
    expect(refusal.length).toBeLessThanOrEqual(300);
    // AND THE REMEDY SURVIVED WHOLE, which is the half the cap used to eat.
    expect(refusal).toContain("`2001:3f:ffff:ffff:ffff:ffff:ffff:ffff/128`");
    expect(refusal).toContain("(ADR-0034)");
    expect(refusal).toContain("droneRemoteIdProtocolEntityTags");
  });

  /**
   * THE DEFECT CNCORE-244 LEFT ONE STEP LATER (CNCORE-287). Its remedy is whole
   * only for a host with ONE address. `localhost` answers with `::1` AND
   * `127.0.0.1` -- measured on this machine, in that order -- and the hook threw
   * on the first record that failed, so the Owner was told to add `::1/128`,
   * did exactly that, and was refused again for `127.0.0.1`. Same sentence,
   * different address, which is CNCORE-244's own opening line recurring.
   *
   * SO ONE REFUSAL ACCOUNTS FOR EVERY ADDRESS THAT NEEDS A CIDR. The Owner
   * pastes the whole list once rather than discovering it an address at a time.
   */
  it("names every address that needs a CIDR, not only the first one checked", () => {
    const assert = assertConfigAddresses(parseAllowlist("localhost"));

    const refusal = refusalFrom(() => assert(["::1", "127.0.0.1"]));

    // BOTH ADDRESSES, as CIDRs to paste rather than as addresses to compose.
    expect(cidrsQuotedIn(refusal)).toEqual(["::1/128", "127.0.0.1/32"]);
    // AND EACH ONE REALLY ADMITS THE ADDRESS IT WAS OFFERED FOR, through the
    // Owner's own path: `parseAllowlist` and then the boundary itself.
    expect(admitsAfterAllowlisting("::1/128", "::1")).toBe(true);
    expect(admitsAfterAllowlisting("127.0.0.1/32", "127.0.0.1")).toBe(true);
    // AND THE WHOLE PASTE ADMITS THE WHOLE HOST, which is the promise that
    // being refused twice broke: allowlisting what it said ends the refusal.
    expect(() =>
      assertConfigAddresses(parseAllowlist("localhost, ::1/128, 127.0.0.1/32"))([
        "::1",
        "127.0.0.1",
      ]),
    ).not.toThrow();
  });

  /**
   * ADR-0123'S PROPERTY IS "THE VERDICT AND THE REMEDY SURVIVE", AND THAT IS A
   * CLAIM ABOUT EVERY N RATHER THAN ABOUT THE SIZES SOMEBODY TRIED.
   *
   * The list is the only part of this sentence that grows, so the list is what
   * is bounded: an entry is added only when the FINISHED sentence still fits.
   * Measured first -- at 39-character ULA addresses the sentence passes 300 on
   * the FOURTH entry -- so six is comfortably past where a fixed shape would
   * have been truncated, and nothing about DNS stops a host answering with
   * more.
   *
   * WHAT COULD NOT BE NAMED IS COUNTED. A partial list the Owner cannot tell is
   * partial is one they paste and get refused for again, which is this
   * ticket's own defect wearing a different hat.
   */
  it("keeps its verdict and remedy however many addresses need a CIDR", () => {
    const assert = assertConfigAddresses(parseAllowlist("provider-wiki"));
    // Six ULA addresses, each rendering at the full 39 characters IPv6 allows.
    const many = ["bcde", "bcdf", "bce0", "bce1", "bce2", "bce3"].map(
      (group) => `fd12:3456:789a:${group}:f012:3456:789a:bcde`,
    );

    const refusal = refusalFrom(() => assert(many));

    // 300 written out, so ADR-0123's constant cannot assert itself.
    expect(refusal.length).toBeLessThanOrEqual(300);
    // THE VERDICT AND THE REMEDY, which are what a cut would have eaten.
    expect(refusal).toContain("no allowlisted CIDR covers them");
    expect(refusal.endsWith("or your network's range (ADR-0034).")).toBe(true);
    // IT SAYS HOW MANY IT IS HOLDING, so the count is never a guess.
    expect(refusal).toContain("refused 6 of this host's addresses");
    // AND IT SAYS SO WHEN IT COULD NOT NAME THEM ALL, rather than handing over
    // a list that looks complete.
    const listed = cidrsQuotedIn(refusal);
    expect(listed.length).toBeLessThan(many.length);
    expect(refusal).toContain(`and ${many.length - listed.length} more,`);
    // EVERY CIDR IT DID NAME STILL WORKS, which is the half a cut would keep
    // looking correct while breaking.
    for (const cidr of listed) {
      expect(admitsAfterAllowlisting(cidr, cidr.replace("/128", ""))).toBe(true);
    }
  });

  /**
   * THE CEILING THIS SENTENCE IS ASSEMBLED AGAINST IS ADR-0123'S, ASSERTED
   * THROUGH THE REAL BOUNDARY RATHER THAN BY COMPARING TWO CONSTANTS.
   *
   * `SENTENCE_MAX` is written in `boundary.ts` and `REASON_MAX_LENGTH` in
   * `reason.ts` -- separately, because that module imports `OutboundRefused`
   * from this one and reaching back for the constant would close a cycle. So
   * the two numbers could drift, and what catches that is the only thing that
   * matters about them agreeing: a refusal built at full stretch reaches a page
   * WHOLE. If the assembly ceiling ever rose above the reason cap, `reasonFor`
   * would truncate what this function was careful to fit.
   */
  it("survives the reason cap it was assembled against, unchanged", () => {
    const assert = assertConfigAddresses(parseAllowlist("provider-wiki"));
    const many = ["bcde", "bcdf", "bce0", "bce1", "bce2", "bce3"].map(
      (group) => `fd12:3456:789a:${group}:f012:3456:789a:bcde`,
    );

    const refusal = refusalFrom(() => assert(many));
    const reason = reasonFor(new OutboundRefused(refusal, "config"));

    expect(reason.text).toBe(refusal);
    expect(reason.wrote).toBe("canoncore");
  });

  /**
   * A ZONE ID IS THE ONLY UNBOUNDED PART OF AN ADDRESS, and it is meaningless
   * in a CIDR. `fe80::1%eth0` is valid to ipaddr.js and an interface name has
   * no length limit, so a remedy built by pasting the address into a string
   * would be both wrong and, once cut, unusable.
   */
  it("drops a scope id rather than quoting a CIDR nobody can allowlist", () => {
    const assert = assertConfigAddresses(parseAllowlist("provider-wiki"));

    const refusal = refusalFrom(() => assert([`fe80::1%${"eth".repeat(40)}`]));

    expect(refusal.length).toBeLessThanOrEqual(300);
    expect(refusal).toContain("`fe80::1/128`");
    expect(refusal).not.toContain("eth");
  });
});

/** The message of the `OutboundRefused` a call throws, or a failure saying it did not. */
function refusalFrom(call: () => void): string {
  try {
    call();
  } catch (error) {
    if (error instanceof OutboundRefused) return error.message;
    throw error;
  }
  throw new Error("expected an OutboundRefused, and nothing was thrown");
}

/** The single CIDR a refusal quotes back in backticks, as the Owner would copy it. */
function cidrQuotedIn(refusal: string): string {
  const quoted = /`([^`]+\/\d+)`/.exec(refusal)?.[1];
  if (!quoted) throw new Error(`no CIDR is quoted in: ${refusal}`);
  return quoted;
}

/** Every CIDR a refusal quotes back, in the order the Owner reads them. */
function cidrsQuotedIn(refusal: string): string[] {
  const found: string[] = [];
  for (const match of refusal.matchAll(/`([^`]+)`/g)) {
    const inside = match[1] ?? "";
    for (const entry of inside.split(", ")) if (/\/\d+$/.test(entry)) found.push(entry);
  }
  if (found.length === 0) throw new Error(`no CIDR is quoted in: ${refusal}`);
  return found;
}

/**
 * Whether pasting this CIDR into the allowlist actually admits this address.
 *
 * THROUGH `parseAllowlist` AND THE BOUNDARY ITSELF, which is the Owner's real
 * path, rather than through `ipaddr.parseCIDR` alone. A quoted entry that
 * ipaddr.js reads and `parseAllowlist` then files somewhere else would still
 * pass the narrower check -- and this whole ticket is one remedy that read
 * correctly and did not work.
 */
function admitsAfterAllowlisting(cidr: string, address: string): boolean {
  try {
    assertConfigAddresses(parseAllowlist(cidr))([address]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Found in review: an owner who allowlists a bare ADDRESS rather than a CIDR was
 * getting silently dead configuration. `127.0.0.1` parsed cleanly, went into the
 * host set, and was then never consulted -- because a URL whose host is an
 * address is matched against CIDRs only. ADR-0034 says "exact hosts AND CIDRs",
 * and an exact address is the most obvious thing to type.
 */
describe("an allowlist entry that is a bare address", () => {
  it("admits exactly that address", () => {
    const allowlist = parseAllowlist("127.0.0.1");

    expect(() => assertConfigUrl(new URL("http://127.0.0.1:8080/"), allowlist)).not.toThrow();
  });

  it("admits that address and NOT its neighbours", () => {
    const allowlist = parseAllowlist("127.0.0.1");

    // A bare address is one address, never the block around it. An owner who
    // wants the block writes the block.
    expect(() => assertConfigUrl(new URL("http://127.0.0.2/"), allowlist)).toThrow(OutboundRefused);
  });

  it("does the same for a bare IPv6 address", () => {
    const allowlist = parseAllowlist("fd00:ec2::254");

    expect(() => assertConfigUrl(new URL("http://[fd00:ec2::254]/"), allowlist)).not.toThrow();
    expect(() => assertConfigUrl(new URL("http://[fd00:ec2::255]/"), allowlist)).toThrow(
      OutboundRefused,
    );
  });

  it("still admits a pinned connection to it", () => {
    // The address rule has to agree with the host rule, or the URL passes and
    // the socket is then refused -- which reads as a network fault.
    const assert = assertConfigAddresses(parseAllowlist("127.0.0.1"));

    expect(() => assert(["127.0.0.1"])).not.toThrow();
    expect(() => assert(["127.0.0.2"])).toThrow(OutboundRefused);
  });
});

/**
 * ALSO FOUND IN REVIEW: nothing asserted the SCHEME. A redirect to
 * `file:///etc/passwd` has an empty hostname, so every address test skipped it,
 * and the only thing refusing it was undici declining to dispatch a non-HTTP
 * request. ADR-0034's boundary must say this itself rather than inherit it from
 * whichever client happens to be underneath.
 */
describe("the scheme", () => {
  it.each(["file:///etc/passwd", "data:text/plain,hello", "gopher://example.com/"])(
    "refuses %s as a content URL",
    (url) => {
      expect(() => assertContentUrl(new URL(url))).toThrow(OutboundRefused);
    },
  );

  it("refuses a config URL that is not http or https", () => {
    const allowlist = parseAllowlist("127.0.0.0/8, wiki.example.com");

    expect(() => assertConfigUrl(new URL("file:///etc/passwd"), allowlist)).toThrow(
      OutboundRefused,
    );
  });

  it("admits http and https", () => {
    const allowlist = parseAllowlist("wiki.example.com");

    expect(() => assertConfigUrl(new URL("https://wiki.example.com/"), allowlist)).not.toThrow();
    expect(() => assertConfigUrl(new URL("http://wiki.example.com/"), allowlist)).not.toThrow();
    expect(() => assertContentUrl(new URL("https://example.com/"))).not.toThrow();
  });

  /**
   * A hostname in a content URL is NOT decided here -- the pinning hook decides
   * it at connect time, from the addresses it actually resolves to. Deciding it
   * here would mean resolving twice and trusting the first answer.
   */
  it("leaves a content hostname for the pinning hook rather than refusing it", () => {
    expect(() => assertContentUrl(new URL("https://provider.example.com/x"))).not.toThrow();
  });

  it("refuses a content URL whose host is a literal address it may not reach", () => {
    expect(() => assertContentUrl(new URL("http://169.254.169.254/"))).toThrow(OutboundRefused);
    expect(() => assertContentUrl(new URL("http://[fd00:ec2::254]/"))).toThrow(OutboundRefused);
  });
});

/**
 * ADR-0034's allowlist is empty by default, which refuses every provider. That
 * is the safe default AND the state a fresh install is in, so a surface has to
 * be able to tell the owner they are in it rather than let an import fail
 * later with a refusal they did not expect (ADR-0094).
 */
describe("whether an allowlist names anything at all", () => {
  it("says no for the default, which is the empty string", () => {
    expect(allowsAnything(parseAllowlist(""))).toBe(false);
  });

  it("says yes for a host, and yes for a range", () => {
    expect(allowsAnything(parseAllowlist("wiki.example"))).toBe(true);
    expect(allowsAnything(parseAllowlist("127.0.0.0/8"))).toBe(true);
  });
});

/**
 * A VALUE IS CUT ON A WHOLE CHARACTER, which `cap` in `reason.ts` documented at
 * length and this function did not do (CNCORE-269).
 *
 * `slice` counts UTF-16 units, so a cut landing between the two halves of an
 * astral character leaves a lone surrogate -- a replacement glyph on the
 * Owner's page, in the sentence telling them what to go and fix. The two
 * functions cut a stranger's string to length for the same reason and now do it
 * through one, so neither can drift from the other's guard.
 *
 * UNREACHABLE FROM TODAY'S CALL SITES AND ASSERTED ANYWAY. Every value reaching
 * this is a URL, a host, an address or a latin-1 header, so no astral character
 * can straddle the cut -- the bound holds by accident of its callers rather than
 * by the function, and the next caller to route a provider's own prose through
 * it is the one that finds out.
 */
describe("a value a refusal quotes back", () => {
  it("leaves a value inside the bound alone", () => {
    expect(shortly("wiki.example.com")).toBe("wiki.example.com");
  });

  it("cuts on a whole character when an astral one straddles the boundary", () => {
    // VALUE_MAX is 80 and the marker takes the last of them, so the cut falls
    // at unit 79. A U+1F600 opening at unit 78 therefore has one half on each
    // side of it, and a bare `slice` keeps the high surrogate alone.
    const straddling = `${"a".repeat(78)}\u{1F600}${"b".repeat(10)}`;

    const shortened = shortly(straddling);

    expect(shortened.isWellFormed()).toBe(true);
    expect(shortened).toBe(`${"a".repeat(78)}\u2026`);
    // VALUE_MAX written out, so the constant cannot assert itself.
    expect(shortened.length).toBeLessThanOrEqual(80);
  });
});
