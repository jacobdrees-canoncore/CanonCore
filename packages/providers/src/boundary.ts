import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { shortenTo } from "@canoncore/text";
import ipaddr from "ipaddr.js";

/**
 * ADR-0034. An outbound request that was not made, and why.
 *
 * A THROW RATHER THAN A BOOLEAN, deliberately. A predicate can be called and
 * its answer dropped, and the resulting hole looks exactly like working code;
 * a refusal that throws cannot be forgotten by a caller who meant to check.
 */
/**
 * Which of ADR-0034's two boundaries a refusal came from, and therefore whose
 * sentence it is (ADR-0123).
 */
export type Boundary = "config" | "content";

export class OutboundRefused extends Error {
  /**
   * WHICH OF THIS RECORD'S TWO BOUNDARIES REFUSED, which is what decides whose
   * sentence this is (ADR-0123). The CONFIG boundary judges a URL the OWNER
   * typed, so its refusal names a setting only they can change and is this app
   * talking to them. The CONTENT boundary judges a URL a PROVIDER wrote, so its
   * refusal quotes the provider's own text back -- `hopTo` interpolates a raw
   * `Location` header -- and is that provider's claim rather than ours.
   *
   * `content` BY DEFAULT, so a refusal added later is capped and attributed to
   * the provider until somebody decides otherwise. That is the conservative
   * direction: the cost of getting it wrong this way is a sentence the Owner
   * reads as a provider's, and the other way it is a provider choosing text the
   * Owner reads as CanonCore's.
   *
   * READ BY `reasonFor` AND NOWHERE ELSE. The refusals raised while PARSING
   * settings at startup never reach it -- they stop the server rather than
   * travelling to a page -- so they are left at the default rather than
   * annotated for a reader that does not exist.
   */
  readonly boundary: Boundary;

  constructor(message: string, boundary: Boundary = "content") {
    super(message);
    this.name = "OutboundRefused";
    this.boundary = boundary;
  }
}

/**
 * What `ipaddr.js` calls an address that matched none of its named special
 * ranges. Everything else -- loopback, private, linkLocal, carrierGradeNat,
 * uniqueLocal, multicast, reserved, ipv4Mapped, unspecified -- is named, and
 * being named is what gets it refused.
 */
const UNICAST = "unicast";

/**
 * How much of an interpolated value a refusal quotes back.
 *
 * ADR-0123 caps a failure reason at 300 characters, and a refusal assembled
 * from a value of any length is not bounded by that -- it is TRUNCATED by it,
 * which costs the Owner the END of the sentence: the half naming the setting to
 * fix. `assertConfigUrl` interpolates the host TWICE, so a 147-character
 * hostname produced a 413-character refusal and the cap ate both "is not an
 * allowlisted host" and the remedy after it. Measured, not imagined.
 *
 * SO THE VALUE IS BOUNDED WHERE IT ENTERS, and the prose around it is then
 * fixed-length and always survives. 80 leaves the longest of these sentences at
 * 269 characters with both of its values at full stretch.
 */
const VALUE_MAX = 80;

/**
 * A value as a refusal quotes it: whole, or its first `VALUE_MAX` characters.
 *
 * An Owner who typed a long host still recognises its opening, and what they
 * cannot do without is the sentence SAYING WHAT TO DO, which is what keeping the
 * value short is protecting.
 *
 * THE CUT ITSELF IS `shortenTo`'S, in `@canoncore/text`, and that is where the
 * reason for its shape is written (CNCORE-269, ADR-0163). This function is the
 * CEILING and not the cut: 80 is a fact about these sentences, and it belongs
 * beside them.
 *
 * THE CUT ALONE, AND NOT `boundedTo`'S PAIR. Every caller below quotes a URL, a
 * host or an address that has already been through a parser, so there is no
 * prose here for the control strip to act on. A caller quoting a stranger's
 * PROSE reaches for `boundedTo` instead, which is what `bounded` does one file
 * over.
 */
export function shortly(value: string): string {
  return shortenTo(value, VALUE_MAX);
}

/**
 * ADR-0034's CONTENT boundary, with NO EXCEPTION EVER: an address is reachable
 * only when its range is the `unicast` catch-all.
 *
 * DENY BY RANGE CLASSIFICATION, NOT BY AN ENUMERATED CIDR LIST. OWASP's own
 * published table lists only `::1/128` and `ff00::/8` for IPv6, while AWS
 * publishes `[fd00:ec2::254]` and GCP publishes `[fd20:ce::254]` as live
 * metadata endpoints -- both ULA in `fd00::/8`, which that table does not cover.
 * It also omits `fc00::/7`, `169.254.0.0/16` as a range, and `100.64.0.0/10`.
 * Classification catches all of them and the next one a cloud vendor invents.
 *
 * `unicast` IS `ipaddr.js`'S WORD AND NOT IANA'S, which is why the refusal below
 * says so. IANA's IPv4 Special-Purpose Address Registry classifies by Source,
 * Destination, Forwardable, Globally Reachable and Reserved-by-Protocol, and
 * `unicast` appears nowhere in it. Restating this rule in the registry's terms
 * is the obvious repair and it ships holes: `224.0.0.0/4` is in a different
 * registry entirely, `192.88.99.0/24` carries an empty Globally Reachable value
 * rather than `False`, and `127.0.0.0/8` carries the literal string `False [1]`
 * -- footnote marker included -- so a naive equality test lets loopback through.
 */
export function assertContentAddress(address: string): void {
  const range = rangeOf(address);
  if (range === UNICAST) return;
  throw new OutboundRefused(
    `refused ${address}: ipaddr.js classifies it as \`${range}\`, and a content URL may only reach \`${UNICAST}\`.`,
  );
}

/**
 * ADR-0034's CONTENT boundary over every address a hostname resolved to.
 *
 * IT STOPS AT THE FIRST FAILURE, AND THAT IS NOT THE DEFECT CNCORE-287 FIXED
 * NEXT DOOR. The config boundary names them all because its refusal carries a
 * REMEDY the Owner carries out, and a remedy that covers one of two addresses
 * sends them round again. Content has no remedy to complete: its rule is
 * "no exception ever", an address it refused stays refused, and there is
 * nothing for the reader to go and do with a second one. Naming more of them
 * would be longer, not more useful.
 */
export const assertContentAddresses: AssertAddresses = (addresses) => {
  for (const address of addresses) assertContentAddress(address);
};

/**
 * The address's range, or `unparseable` for a string that is not an address at
 * all.
 *
 * An unreadable value is REFUSED rather than parsed leniently. It arrives from
 * a redirect header or a response body, so it is attacker-shaped input, and
 * "could not read it" must never resolve to "carry on".
 */
function rangeOf(address: string): string {
  if (!ipaddr.isValid(address)) return "unparseable";
  return ipaddr.parse(address).range();
}

/**
 * ADR-0034's ALLOWLIST: exact hosts and CIDRs, with NO WILDCARDS.
 *
 * Two lists rather than one, because a hostname and an address are matched as
 * the different things they are. Nothing is resolved here, so an entry of one
 * kind can never admit a URL of the other.
 */
export interface Allowlist {
  readonly hosts: ReadonlySet<string>;
  readonly ranges: readonly [ipaddr.IPv4 | ipaddr.IPv6, number][];
}

/**
 * Reads the owner's allowlist out of one configured string: entries separated
 * by commas or whitespace, each an exact host or a CIDR.
 *
 * A MALFORMED ENTRY THROWS RATHER THAN BEING SKIPPED. Silently dropping one
 * leaves the owner believing a destination is reachable when it is not, and
 * they find out at the first import rather than at the moment they typed it.
 */
export function parseAllowlist(configured: string): Allowlist {
  const hosts = new Set<string>();
  const ranges: [ipaddr.IPv4 | ipaddr.IPv6, number][] = [];

  for (const entry of configured.split(/[\s,]+/).filter(Boolean)) {
    if (entry.includes("*")) {
      throw new OutboundRefused(
        `allowlist entry \`${entry}\` uses a wildcard, and ADR-0034's allowlist takes exact hosts and CIDRs only.`,
      );
    }
    if (entry.includes("/")) {
      if (!ipaddr.isValidCIDR(entry)) {
        throw new OutboundRefused(`allowlist entry \`${entry}\` is not a readable CIDR.`);
      }
      ranges.push(ipaddr.parseCIDR(entry));
      continue;
    }
    // A BARE ADDRESS IS A RANGE OF ONE, never a hostname. ADR-0034 says "exact
    // hosts AND CIDRs", and an exact address is the most obvious thing an owner
    // types -- but a URL whose host is an address is matched against ranges, so
    // filing `127.0.0.1` under hostnames made it configuration that parsed
    // cleanly and was then never consulted. Found in review, and silent: the
    // refusal it produced said the address was on no allowlisted CIDR, which
    // was true and useless.
    if (ipaddr.isValid(entry)) {
      const address = ipaddr.parse(entry);
      ranges.push([address, fullPrefix(address)]);
      continue;
    }
    // Lower-cased on the way in AND on the way out: a hostname is
    // case-insensitive, and a set does exact matching, so the only place the
    // two can be reconciled is at both ends.
    hosts.add(entry.toLowerCase());
  }

  return { hosts, ranges };
}

/**
 * Whether this allowlist names ANY destination, which is the question a surface
 * asks before telling an owner why their catalogue cannot fill.
 *
 * ADR-0034 makes the allowlist empty by default and that refuses every
 * provider, so an unconfigured instance and a misconfigured one look identical
 * from a page: no import works, and nothing says why. ADR-0094 is explicit that
 * an install starting empty WITHOUT SAYING WHAT TO DO NEXT is a separate
 * failure, and this is the fact the saying rests on.
 *
 * IT LIVES BESIDE `parseAllowlist` RATHER THAN AT THE CALLER, because it is a
 * question about the shape `parseAllowlist` returns: the two lists are two
 * fields today, and a caller reading both by hand is a caller that keeps
 * answering `true` the day a third arrives.
 */
export function allowsAnything(allowlist: Allowlist): boolean {
  return allowlist.hosts.size > 0 || allowlist.ranges.length > 0;
}

/**
 * A URL's host as an ADDRESS would be written, with the brackets the URL syntax
 * puts round an IPv6 literal removed.
 *
 * One function rather than the same ternary at each site: the two boundaries
 * must agree about what the host of `http://[fd00::1]/` is, and two copies of a
 * string operation is where they would quietly stop agreeing.
 */
function bareHost(url: URL): string {
  const hostname = url.hostname;
  return hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
}

/**
 * Both boundaries refuse anything that is not HTTP.
 *
 * SAID HERE RATHER THAN INHERITED. A `file:` or `data:` URL has an empty
 * hostname, so every address test skips it, and the only thing refusing one was
 * undici declining to dispatch a non-HTTP request. That is a guarantee borrowed
 * from whichever client happens to be underneath, and ADR-0034's boundary has
 * to hold on its own.
 */
function assertHttpScheme(url: URL, boundary: Boundary): void {
  if (url.protocol === "http:" || url.protocol === "https:") return;
  throw new OutboundRefused(
    `refused ${shortly(url.href)}: the scheme is \`${url.protocol}\` and a provider is reached over HTTP.`,
    boundary,
  );
}

/**
 * ADR-0034's CONTENT boundary at the URL, judged before a connection is opened.
 *
 * A LITERAL ADDRESS IS DECIDED HERE; a hostname is left to the content agent's
 * pinning hook at connect time, because deciding it here would mean resolving it
 * twice and trusting the first answer.
 */
export function assertContentUrl(url: URL): void {
  assertHttpScheme(url, "content");
  const host = bareHost(url);
  // A hostname is not an address and must fall through to the lookup hook
  // rather than be refused as unparseable, so this asks whether it IS one.
  if (ipaddr.isValid(host)) assertContentAddress(host);
}

/**
 * ADR-0034's CONFIG boundary: a provider base URL is one the OWNER typed, which
 * is OWASP's Case 1 -- an identified and trusted destination -- so it is checked
 * against the allowlist rather than against the content deny rule.
 *
 * THIS IS WHAT MAKES A LOOPBACK OR TAILNET PROVIDER LEGAL BY NAME. The content
 * rule refuses `loopback` and `carrierGradeNat` and goes on refusing them; a
 * base URL is simply a different kind of URL being asked a different question,
 * never an exception carved into a rule that forbids it.
 *
 * `URL.hostname` rather than `host`, so the port is not part of the comparison
 * and an IPv6 literal arrives without the brackets the URL syntax puts round it.
 * A port is not a destination and ADR-0034's allowlist takes hosts and CIDRs.
 */
export function assertConfigUrl(url: URL, allowlist: Allowlist): void {
  assertHttpScheme(url, "config");
  const hostname = url.hostname;
  const bare = bareHost(url);

  if (ipaddr.isValid(bare)) {
    const address = ipaddr.parse(bare);
    if (allowlist.ranges.some((range) => matches(address, range))) return;
    throw new OutboundRefused(
      `refused ${shortly(url.origin)}: ${withoutScope(address)} is on no allowlisted CIDR. Add \`${coveringCidr(address)}\` or your network's range (ADR-0034).`,
      "config",
    );
  }

  if (allowlist.hosts.has(hostname.toLowerCase())) return;
  throw new OutboundRefused(
    `refused ${shortly(url.origin)}: ${shortly(hostname)} is not an allowlisted host. The allowlist takes exact hosts, so a parent domain does not cover it.`,
    "config",
  );
}

/**
 * Whether one address sits in one CIDR, WITHOUT crossing address families.
 *
 * `match` throws on a family mismatch rather than answering false, so an IPv4
 * URL checked against an IPv6 entry would take the whole request down instead
 * of simply not matching that entry.
 */
function matches(
  address: ipaddr.IPv4 | ipaddr.IPv6,
  [network, bits]: readonly [ipaddr.IPv4 | ipaddr.IPv6, number],
): boolean {
  if (address.kind() !== network.kind()) return false;
  return address.match(network, bits);
}

/**
 * The narrowest CIDR that admits one address, as a refusal hands it to the
 * Owner to copy into their allowlist (CNCORE-244).
 *
 * REBUILT FROM THE PARSE RATHER THAN FROM THE STRING, which is what makes it
 * WHOLE. Everything else a refusal interpolates is bounded by `shortly`, and a
 * remedy that has been CUT is a remedy that cannot work -- which is the defect
 * this function was added to end, reintroduced one layer down. An address
 * rebuilt from `parts` or `octets` is at most 39 characters and carries no zone
 * id, so it needs no ceiling and can never be truncated.
 *
 * A SINGLE ADDRESS AND NOT THE BLOCK AROUND IT, deliberately. Offering the
 * enclosing block instead turns `::1` into `::/64`, which covers every
 * IPv4-MAPPED address -- ADR-0034 records that trap and the matching one in
 * ipaddr.js's `SpecialRanges`, and why an allowlist is narrowed by preference.
 * The sentence names the network's range as the Owner's other option, which is
 * the entry the README tells them to read off `docker network inspect` and the
 * one that survives the network being recreated.
 */
function coveringCidr(address: ipaddr.IPv4 | ipaddr.IPv6): string {
  return `${withoutScope(address)}/${fullPrefix(address)}`;
}

/**
 * The prefix length that covers exactly one address of this family.
 *
 * SHARED WITH `parseAllowlist`, which is the OTHER END OF THE SAME ROUND TRIP:
 * this is the CIDR a refusal hands the Owner, and that is how their paste of it
 * is read back. Written twice they could disagree, and the way they would fail
 * is silent -- a refusal quoting an entry the parser then files as a different
 * range.
 */
function fullPrefix(address: ipaddr.IPv4 | ipaddr.IPv6): 32 | 128 {
  return address instanceof ipaddr.IPv6 ? 128 : 32;
}

/**
 * An address as a refusal prints it: rebuilt from the parse, SO IT CARRIES NO
 * SCOPE ID.
 *
 * A zone is the one part of an address with no length limit -- `fe80::1%eth0`
 * is valid and an interface name can be anything -- and `toString` keeps it.
 * Measured: a 120-character zone took this refusal to 304 characters, over
 * ADR-0123's ceiling, and the clause it pushed off the end was the remedy. It
 * is also meaningless in a CIDR, so dropping it is what makes the quoted
 * allowlist entry one that works.
 *
 * WHICH IS WHY THESE TWO VALUES NEED NO `shortly`. Everything left is bounded
 * by the address syntax itself: 15 characters for IPv4 and 39 for IPv6.
 *
 * NOT NAMED `bounded`, which is `reason.ts`'s word for ADR-0123's 300-character
 * cap and is published beside `reasonFor`. One word for two ceilings in one
 * package is how the next reader comes to apply the wrong one.
 */
function withoutScope(address: ipaddr.IPv4 | ipaddr.IPv6): string {
  if (address instanceof ipaddr.IPv6) return new ipaddr.IPv6(address.parts).toString();
  return address.toString();
}

/**
 * One address a hostname resolved to. Node's own type, not a copy of it: this
 * value is handed straight back to the connector, so anything else here would
 * be a second declaration of the platform's shape waiting to disagree with it.
 */
export type ResolvedAddress = LookupAddress;

/** How a hostname becomes addresses. Injectable so a test can supply records. */
export type Resolve = (hostname: string) => Promise<ResolvedAddress[]>;

/**
 * What a boundary does to EVERY address a hostname resolved to: returns when
 * the connection may proceed, throws otherwise.
 *
 * THE WHOLE LIST AND NOT ONE ADDRESS (CNCORE-287). Handed them one at a time,
 * a boundary can only ever refuse the FIRST that fails, and the config
 * boundary's refusal quotes a CIDR to paste -- so a dual-stack host sent the
 * Owner round the loop once per address: told to add `::1/128`, doing exactly
 * that, and being refused again for `127.0.0.1`. A remedy is whole only if it
 * accounts for every address that needs one, and only a boundary holding the
 * list can write it.
 *
 * AN EMPTY LIST IS NOT THIS TYPE'S REFUSAL TO MAKE. Both implementations return
 * for one, and the refusal a hostname with no address earns is raised in
 * `pinnedLookup` BEFORE either is called -- which is where it has to be, because
 * "resolves to no address" is a fact about the host rather than about any
 * address, and ADR-0123 records it as one raised for both dispatchers.
 *
 * THE TYPE IS SHARED AND THE RULES ARE NOT, which is ADR-0034's split surviving
 * the change. Both boundaries take the same shape because both answer the same
 * question about the same list; WHICH rule judges a hop is decided once in
 * `client.ts`, by which dispatcher carries which hook, and nothing here lets a
 * content hop reach the allowlist.
 */
export type AssertAddresses = (addresses: readonly string[]) => void;

/**
 * Every A and AAAA record for a hostname. `all: true` ALWAYS, whatever the
 * caller asked for -- see `pinnedLookup` for why that is the security property
 * rather than a convenience.
 */
const resolveEveryRecord: Resolve = async (hostname) =>
  (await import("node:dns/promises")).lookup(hostname, { all: true });

/**
 * ADR-0034's connection pinning, as the DNS `lookup` hook undici hands to
 * `net.connect` and `tls.connect`.
 *
 * THE HOOK IS THE MECHANISM, and the alternative is worse in a way that passes
 * its own tests: rewriting the URL's host to the resolved IP also pins the
 * connection, and it silently breaks SNI, because Node's TLS documentation says
 * `servername` "must be a host name, and not an IP address". The request then
 * goes out with no server name, the certificate is checked against an address
 * instead of the host, and everything appears to work. Resolving inside the
 * hook leaves the URL's host exactly as written, so SNI and certificate
 * validation are untouched and the socket still connects only to addresses this
 * function approved.
 *
 * EVERY RECORD IS CHECKED, NEVER THE FIRST. Node's `autoSelectFamily` defaults
 * to true now, so the connector walks the whole list until something answers --
 * which means an unchecked address later in the list is an address that can be
 * connected to. `options.all` describes the shape of the ANSWER and never how
 * much of the resolution is trusted, so it is deliberately not consulted until
 * after every record has passed.
 */
export function pinnedLookup(
  assertAddresses: AssertAddresses,
  resolve: Resolve = resolveEveryRecord,
): LookupFunction {
  return (hostname, options, callback) => {
    void (async () => {
      // TWO try BLOCKS RATHER THAN ONE, because the two failures are different
      // facts. A resolver failure reaches the caller AS ITSELF -- turning it
      // into a refusal would report "this address is not allowed" about a host
      // that has no address at all.
      let addresses: ResolvedAddress[];
      try {
        addresses = await resolve(hostname);
      } catch (error) {
        // The second argument is what the connector reads only when the error
        // is null, and every consumer short-circuits on the error first. Node's
        // own signature declares it non-optional, so it is supplied and unread.
        callback(error as NodeJS.ErrnoException, "");
        return;
      }

      try {
        const [first] = addresses;
        // Not "no answer, carry on": a hostname with no address is a connection
        // that cannot be pinned, and an empty answer handed to the connector
        // would look like a result.
        if (!first) throw new OutboundRefused(`refused ${hostname}: it resolves to no address.`);

        // EVERY RECORD IS HANDED OVER AT ONCE, never one at a time. The loop
        // that used to live here could only report the first failure, which is
        // what sent a dual-stack host's Owner round the remedy twice
        // (CNCORE-287). What is refused is unchanged; what the refusal can
        // ACCOUNT FOR is the whole answer.
        assertAddresses(addresses.map((record) => record.address));

        // Only now does the shape of the answer matter.
        if (options.all) callback(null, addresses);
        else callback(null, first.address, first.family);
      } catch (error) {
        // A REFUSAL MUST ARRIVE AT THE CALLBACK. Thrown out of here it becomes
        // an unhandled rejection and the connector waits for an answer that
        // never comes, which is a hang rather than a refusal -- measured, and
        // it is what this function did before the pinning tests were written.
        //
        // AND IT REACHES A PAGE WRAPPED, WHICH IS THIS CALLBACK'S OWN COST
        // (CNCORE-192). Handed to undici rather than thrown on the caller's
        // stack, it comes back out of `fetch` as `TypeError: fetch failed` with
        // this error on `cause` -- intact, `boundary` and all, and invisible to
        // anything reading the thrown thing directly. `reasonFor` unwraps the
        // chain; ADR-0123 records what that is owed.
        callback(error as NodeJS.ErrnoException, "");
      }
    })();
  };
}

/**
 * The CONFIG boundary's ADDRESS rule, which is what pins a connection to a
 * provider base URL once its host has passed `assertConfigUrl`.
 *
 * TWO CHECKS OF ONE URL, and they answer different questions. The host check
 * asks whether the owner named this destination. This asks what the socket is
 * actually about to connect to, which is DNS's answer rather than the owner's
 * -- so an allowlisted HOSTNAME resolving to 169.254.169.254 fails here. That is
 * DNS rebinding, and the host check cannot see it by construction.
 *
 * ITS REFUSAL SAYS "Its host is allowlisted", AND THAT IS A PRECONDITION RATHER
 * THAN A GUESS. `assertConfigUrl` refuses an unallowlisted host before a socket
 * opens, a base URL whose host is a literal ADDRESS is matched against the
 * ranges there and never reaches this hook, and `client.ts` swaps to the
 * CONTENT dispatcher for every hop after the first. So reaching here means the
 * name passed and a CIDR is what is missing. A second caller that does not hold
 * that would make the sentence false; there is one, and ADR-0034 records why.
 *
 * An address passes when it is ordinary (`unicast`) OR sits in a CIDR the owner
 * allowlisted. The second half is the whole point of the config boundary
 * existing: `127.0.0.0/8` and `100.64.0.0/10` are refused in content and
 * reachable here, BY NAME, because the owner wrote them down -- and "by name"
 * means the CIDR written down, never the hostname. That reading is what
 * CNCORE-244 found this phrase sending a first-time Owner off to do.
 */
export function assertConfigAddresses(allowlist: Allowlist): AssertAddresses {
  return (addresses) => {
    const needing: (ipaddr.IPv4 | ipaddr.IPv6)[] = [];
    const named = new Set<string>();

    for (const address of addresses) {
      if (!ipaddr.isValid(address)) {
        throw new OutboundRefused(
          `refused ${shortly(address)}: it is not a readable address.`,
          "config",
        );
      }
      const parsed = ipaddr.parse(address);
      if (parsed.range() === UNICAST) continue;
      if (allowlist.ranges.some((range) => matches(parsed, range))) continue;
      // DEDUPLICATED BY THE CIDR THE OWNER WOULD PASTE, not by the string that
      // arrived. `fe80::1%eth0` and `fe80::1%eth1` are two records and ONE
      // allowlist entry, because a zone id is meaningless in a CIDR and
      // `withoutScope` has already dropped it -- so naming both would ask for
      // the same line twice.
      const entry = withoutScope(parsed);
      if (named.has(entry)) continue;
      named.add(entry);
      needing.push(parsed);
    }

    const [first] = needing;
    if (!first) return;
    if (needing.length === 1) {
      throw new OutboundRefused(
        `refused ${withoutScope(first)}: ipaddr.js classifies it as \`${first.range()}\` and no allowlisted CIDR covers it. Its host is allowlisted; that admits the name only. Add \`${coveringCidr(first)}\` or your network's range (ADR-0034).`,
        "config",
      );
    }
    throw new OutboundRefused(refusalNaming(needing.map(coveringCidr)), "config");
  };
}

/**
 * ADR-0123's ceiling, RESTATED HERE BECAUSE THESE SENTENCES ARE ASSEMBLED
 * AGAINST IT rather than merely measured after the fact.
 *
 * NOT IMPORTED FROM `reason.ts`, which is where `REASON_MAX_LENGTH` lives and
 * has to stay: that module imports `OutboundRefused` from this one, so reaching
 * back for the constant would close a cycle. `VALUE_MAX` above already reasons
 * about the same 300 without importing it.
 *
 * WHAT STOPS THEM DRIFTING IS A TEST OF THE PROPERTY AND NOT A COMPARISON OF
 * THE TWO NUMBERS, which neither exports and neither should. A refusal built at
 * full stretch is passed through `reasonFor` and asserted to come back
 * UNCHANGED: if this ceiling ever rose above the reason cap, the sentence this
 * function was careful to fit would be truncated on its way to the page, and
 * that is the test that goes red.
 */
const SENTENCE_MAX = 300;

/**
 * One refusal accounting for every address that needs a CIDR (CNCORE-287),
 * BUILT SO THAT IT CANNOT OVERRUN ADR-0123'S CAP AT ANY NUMBER OF THEM.
 *
 * THE LIST IS THE ONLY PART THAT GROWS, so the list is the part that is
 * bounded. Each entry is added only if the FINISHED sentence still fits, which
 * means the verdict and the remedy are never the thing that falls off the end
 * -- and that is ADR-0123's actual property. Measuring a few sizes and finding
 * them comfortable is not the same claim: at 39-character IPv6 addresses this
 * sentence passes 300 on the fourth entry, and nothing about DNS stops a host
 * answering with more.
 *
 * WHAT IS DROPPED IS COUNTED RATHER THAN SILENTLY LOST, because a list the
 * Owner cannot tell is partial is one they paste and get refused for again.
 * The clause that survives every cut is "or your network's range", which is the
 * COMPLETE remedy for exactly this case and the one the README already sends
 * them to `docker network inspect` for.
 *
 * IT DOES NOT NAME ipaddr.js'S CLASSIFICATION, and the single-address sentence
 * does. Measured: carrying the range name too puts two full-stretch IPv6
 * addresses at 318 characters, over the cap, so the classification is what a
 * multi-address refusal spends its budget on LAST. The Owner acts on the CIDRs.
 */
function refusalNaming(cidrs: readonly string[]): string {
  const say = (listed: readonly string[]) => {
    const dropped = cidrs.length - listed.length;
    const more = dropped > 0 ? ` and ${dropped} more,` : "";
    return `refused ${cidrs.length} of this host's addresses: no allowlisted CIDR covers them. Its host is allowlisted; that admits the name only. Add \`${listed.join(", ")}\`${more} or your network's range (ADR-0034).`;
  };

  // THE FIRST ENTRY IS NOT NEGOTIABLE and needs no room made for it: the fixed
  // prose plus one 43-character CIDR is 206 characters, so a sentence naming a
  // single CIDR fits whatever else is true. Everything after it has to earn its
  // place.
  //
  // THE SENTENCE STILL GROWS AFTER THE LIST STOPS, BY THE DIGITS OF TWO COUNTS
  // -- 263 at four addresses, 264 at ten, 268 at a thousand. That is why the
  // test below walks N rather than sampling it: the part nothing measures is
  // the part that was supposed to be fixed-length.
  let listed = cidrs.slice(0, 1);
  for (const cidr of cidrs.slice(1)) {
    const wider = [...listed, cidr];
    if (say(wider).length > SENTENCE_MAX) break;
    listed = wider;
  }
  return say(listed);
}
