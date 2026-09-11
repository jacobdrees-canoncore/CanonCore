/**
 * The only product of this package is `tsconfig.base.json`, so the only thing
 * worth checking is that it actually delivers the strictness every other
 * package inherits from it.
 *
 * Each `@ts-expect-error` below fails to compile if the option it names is OFF,
 * because an unused `@ts-expect-error` is itself an error. That makes this file
 * a real check rather than a vacuous one: `tsc --showConfig` was tried first and
 * exits 0 on a malformed config and on an unknown compiler option alike.
 *
 * Not a Vitest suite. It is compiled by `pnpm typecheck`, which is where a
 * compiler-option regression belongs.
 */

// noUncheckedIndexedAccess: an index access must be possibly-undefined.
const items: string[] = [];
const first = items[0];
// @ts-expect-error `first` is `string | undefined` while the option is on.
export const length: number = first.length;

// strict (strictNullChecks): null is not assignable to a non-nullable type.
// @ts-expect-error
export const name: string = null;

// noImplicitAny, from strict.
// @ts-expect-error
export function greet(who) {
  return `hello ${who}`;
}

// noFallthroughCasesInSwitch.
export function describe(kind: "work" | "person"): string {
  let out = "";
  switch (kind) {
    // The fallthrough IS the assertion, so the linter has to be told to leave it
    // alone. The two comments below are order-sensitive and each fails loudly if
    // the order is broken: Biome only honours a suppression that is the last
    // comment before the node, and tsc reports an unused `@ts-expect-error`.
    // @ts-expect-error this case falls through to the next one.
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: tsc's noFallthroughCasesInSwitch is what must object here.
    case "work":
      out = "a work";
    case "person":
      return "a person";
  }
  return out;
}
