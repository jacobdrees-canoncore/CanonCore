/**
 * WHAT THE OWNER READS ABOUT A PROVIDER'S CREDENTIAL, AND WHERE THEY GO TO
 * SUPPLY IT (ADR-0122, CNCORE-101).
 *
 * CANONCORE NEVER HOLDS THE VALUE. It reads the provider's own declaration off
 * the manifest it was fetching anyway, renders the label and the state, and
 * LINKS to the provider's own unlock path. The Owner gives the credential to the
 * provider directly and the provider writes it to its own config directory,
 * which is the source of truth -- so a script or a scheduled job Unlocks one
 * exactly as a person does.
 *
 * Separate from `configured.ts`, which answers WHICH providers this instance
 * names, and from `boundary.ts`, which answers whether one may be REACHED. This
 * answers what the one that was reached had to say for itself.
 */

import { type Allowlist, assertConfigUrl } from "./boundary";
import { createProviderClient } from "./client";
import type { CmppManifest } from "./cmpp";
import { bounded, type FailureReason, reasonFor } from "./reason";

/**
 * The URL the Owner clicks to Unlock a provider, or `null` where the path the
 * provider declared would take them somewhere else.
 *
 * THE PROVIDER NAMES A PATH AND CANONCORE HOLDS THE BASE URL. That split is
 * CMPP's, and it is load-bearing rather than pedantic: a provider behind a proxy
 * cannot know the URL CanonCore reaches it on, and every other URL in the
 * contract comes FROM the source rather than addressing the provider.
 *
 * THE ORIGIN IS CHECKED ON THE JOIN, NOT ON THE STRING, and that is this
 * function's whole reason to exist. The contract requires a leading `/` and
 * three spellings satisfy it while leaving the provider's origin entirely --
 * measured on node 24.19.0 against `http://provider-wiki:8080`, each of
 * `//evil.test/unlock`, `/\evil.test/unlock` and a tab-prefixed path resolves to
 * `http://evil.test/`. The WHATWG parser reads a backslash as a second slash and
 * strips leading tabs, so a string check cannot see what the join does.
 *
 * IT MATTERS BECAUSE OF WHERE THIS VALUE LANDS. A provider is an untrusted URL
 * (ADR-0031) and this one goes into an `href` the Owner is being asked to click
 * and then type a credential into -- so a declared path that leaves the provider
 * is a phishing sink rather than a cosmetic fault, and it is the ONE thing in
 * this design that could hand a stranger the credential the design exists to
 * keep out of CanonCore's hands.
 *
 * `null` RATHER THAN A THROW, because the provider is up and its state is worth
 * showing. Refusing the whole manifest would report a reachable provider as
 * unreachable, which is the wrong diagnosis shown to the one person who can fix
 * it -- the same argument ADR-0122 makes for a locked provider not refusing to
 * start.
 */
export function unlockUrlFor(baseUrl: string, unlockPath: string): string | null {
  const base = new URL(baseUrl);
  const unlock = new URL(unlockPath, base);
  return unlock.origin === base.origin ? unlock.href : null;
}

/**
 * What a provider had to say about the credential it needs, as a page renders
 * it.
 *
 * `unlockUrl` IS NULLABLE AND THE REST IS NOT, which is the one asymmetry here.
 * Everything else comes straight off the manifest; the URL is the only field
 * CanonCore computes, and it is the only one a provider can declare in a form
 * this app refuses to honour. See `unlockUrlFor`.
 */
export interface DeclaredCredential {
  /** One sentence for the OWNER, in the provider's words, bounded by this app. */
  label: string;
  /** Where the Owner goes, on the provider, or `null` where the declared path left it. */
  unlockUrl: string | null;
  /** `absent`, `valid` or `expired`, and only the provider can know which. */
  state: "absent" | "valid" | "expired";
  /** When it last became that, or `null` where nothing was ever supplied. */
  changedAt: string | null;
}

/**
 * How far CanonCore got with one named provider, and what it found there.
 *
 * THREE OUTCOMES RATHER THAN A REASON AND A FLAG, because ADR-0122 requires the
 * Owner to tell "this Provider needs Unlocking" from "this Provider cannot be
 * reached" from "this Provider is not admitted by the allowlist" -- three
 * different things with three different fixes. A shape that let the page infer
 * one from the absence of another is how two of them come to render identically.
 *
 * A DISCRIMINATED UNION SO THE IMPOSSIBLE COMBINATIONS CANNOT BE BUILT. A
 * credential belongs only to a provider that was reached; a reason belongs only
 * to one that was not. Carrying both as optional fields on one object would let
 * a page render a credential for a provider that never answered.
 */
export type Reach =
  /**
   * ADR-0034's config boundary refuses this provider's host, so nothing was
   * sent. ASKED BEFORE THE REQUEST rather than read off its failure: the
   * boundary would refuse it anyway, but an answer inferred from an error
   * message is one that changes when the message does.
   */
  | { kind: "not-admitted" }
  /**
   * It was admitted and it did not answer, or answered something CMPP does not
   * accept. The reason is bounded and attributed (ADR-0123) -- it is a third
   * party's text on the Owner's page, and this is the fourth surface to carry
   * one, which is why `reasonFor` is one function rather than four catches.
   */
  | { kind: "unreachable"; reason: FailureReason }
  /**
   * It answered a manifest. `credential: null` is a provider that needs nothing
   * and is the ordinary case -- every provider that existed before ADR-0122.
   */
  | { kind: "reached"; credential: DeclaredCredential | null };

/** One named provider, and how far CanonCore got with it. */
export interface ProviderReach {
  /**
   * As the Owner typed it, which is the provider's identity (ADR-0031) and the
   * key the settings surface renders its row under.
   */
  baseUrl: string;
  reach: Reach;
}

/**
 * Reaching every named provider's manifest at once, for the settings surface.
 *
 * THE MANIFEST IS A READ CANONCORE WAS MAKING ANYWAY (ADR-0122), which is what
 * buys the credential's state with no polling and no health check the contract
 * does not define. The provider is the only thing that can know whether its
 * credential still works, because it is the one being refused by the upstream.
 *
 * EACH PROVIDER CATCHES ITS OWN, which is `searchProviders`' lesson at a
 * different surface: `Promise.all` rejects on the first failure, so one dead
 * provider would empty the settings page of every OTHER provider's state -- and
 * would do it non-deterministically, whichever lost the race.
 *
 * IN THE ORDER THE OWNER NAMED THEM, for the same reason that function gives:
 * pushing as each settles orders the page by which provider was quickest, which
 * is a different page on every request.
 */
export async function reachProviders({
  baseUrls,
  allowlist,
}: {
  baseUrls: string[];
  allowlist: Allowlist;
}): Promise<ProviderReach[]> {
  return Promise.all(
    baseUrls.map(async (baseUrl) => ({ baseUrl, reach: await reachOne(baseUrl, allowlist) })),
  );
}

async function reachOne(baseUrl: string, allowlist: Allowlist): Promise<Reach> {
  if (!admits(allowlist, baseUrl)) return { kind: "not-admitted" };

  const client = createProviderClient({ baseUrl, allowlist });
  try {
    const { credential } = await client.manifest();
    return {
      kind: "reached",
      credential: credential === undefined ? null : asDeclared(baseUrl, credential),
    };
  } catch (thrown) {
    return { kind: "unreachable", reason: reasonFor(thrown) };
  } finally {
    // Two undici agents and therefore two connection pools. Left open they keep
    // sockets alive long after the one manifest that needed them.
    await client.close();
  }
}

/** The provider's declaration, as this app renders it. */
function asDeclared(
  baseUrl: string,
  credential: NonNullable<CmppManifest["credential"]>,
): DeclaredCredential {
  return {
    // BOUNDED, BECAUSE IT IS A STRANGER'S PROSE ON THE OWNER'S PAGE (ADR-0123).
    // The contract bounds this only by `min(1)`, and the same function every
    // other provider text in this app goes through is what keeps the ceiling
    // one ceiling rather than one per surface.
    label: bounded(credential.label),
    unlockUrl: unlockUrlFor(baseUrl, credential.unlock_path),
    state: credential.state,
    changedAt: credential.state_changed_at,
  };
}

/**
 * Whether ADR-0034's allowlist admits this provider's host.
 *
 * IT ASKS `assertConfigUrl`, WHICH IS THE BOUNDARY ITSELF. The question a page
 * renders and the question asked in front of a request must be one question: a
 * surface that said "admitted" where the boundary refuses would tell the Owner
 * their configuration works and the request would fail anyway. A second
 * implementation comparing hosts would disagree on exactly the entries that are
 * hard -- a CIDR, an address literal, a port.
 *
 * A PROVIDER WHOSE ENTRY THE BOUNDARY CANNOT EVEN READ IS NOT ADMITTED. Nothing
 * can name such an entry through the settings router, but a row written by hand
 * could hold one, and "not admitted" is the safe reading of it.
 */
export function admits(allowlist: Allowlist, baseUrl: string): boolean {
  try {
    assertConfigUrl(new URL(baseUrl), allowlist);
    return true;
  } catch {
    return false;
  }
}
