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
      ranges.push([address, address.kind() === "ipv6" ? 128 : 32]);
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
      `refused ${shortly(url.origin)}: ${withoutScope(address)} is on no allowlisted CIDR. Allowlist \`${coveringCidr(address)}\` (ADR-0034).`,
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
 * A SINGLE ADDRESS AND NOT THE BLOCK AROUND IT, deliberately, and the obvious
 * widenings both ship holes. Zeroing the low bits to offer `172.19.0.0/16`
 * reads as the more useful suggestion and turns `::1` into `::/64` -- which
 * covers every IPv4-MAPPED address, so the refusal would be telling the Owner
 * to allowlist `::ffff:169.254.169.254`. Reading the enclosing block out of
 * ipaddr.js's own `SpecialRanges` fails the same way: `ipv4Mapped` is
 * `::ffff:0:0/96`. An allowlist is narrowed by preference (ADR-0034 quotes
 * OWASP: "Deny-lists are bypass-prone. Prefer allow-lists."), and an Owner who
 * wants the network's range writes the network's range -- which is what
 * `parseAllowlist`'s bare-address rule already assumes they may do.
 */
function coveringCidr(address: ipaddr.IPv4 | ipaddr.IPv6): string {
  return `${withoutScope(address)}/${address.kind() === "ipv6" ? 128 : 32}`;
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
  if (address.kind() === "ipv6") return new ipaddr.IPv6((address as ipaddr.IPv6).parts).toString();
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

/** What a boundary does to one address: returns for allowed, throws otherwise. */
export type AssertAddress = (address: string) => void;

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
  assertAddress: AssertAddress,
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

        for (const { address } of addresses) assertAddress(address);

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
 * An address passes when it is ordinary (`unicast`) OR sits in a CIDR the owner
 * allowlisted. The second half is the whole point of the config boundary
 * existing: `127.0.0.0/8` and `100.64.0.0/10` are refused in content and
 * reachable here, BY NAME, because the owner wrote them down.
 */
export function assertConfigAddress(allowlist: Allowlist): AssertAddress {
  return (address) => {
    if (!ipaddr.isValid(address)) {
      throw new OutboundRefused(
        `refused ${shortly(address)}: it is not a readable address.`,
        "config",
      );
    }
    const parsed = ipaddr.parse(address);
    if (parsed.range() === UNICAST) return;
    if (allowlist.ranges.some((range) => matches(parsed, range))) return;
    const covering = coveringCidr(parsed);
    throw new OutboundRefused(
      `refused ${withoutScope(parsed)}: ipaddr.js classifies it as \`${parsed.range()}\` and no allowlisted CIDR covers it. Its host is allowlisted, which admits the name only. Allowlist \`${covering}\` too (ADR-0034).`,
      "config",
    );
  };
}
