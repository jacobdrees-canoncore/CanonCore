/**
 * HOW LONG A NARROWING MAY BE: the `kind` and the `group` a reader narrows a
 * Listing to (CNCORE-284, CNCORE-309, ADR-0182).
 *
 * NEITHER IS BOUNDED BY WHAT IT NAMES, and that is the whole gap. Both are
 * declared `z.string()` on purpose -- whether a value names a kind or a Group
 * is the DATABASE's answer rather than this repository's (ADR-0066) -- so
 * nothing about the SET puts a ceiling on the VALUE, and a stranger chose the
 * length of both.
 *
 * ONE NUMBER FOR BOTH PARAMETERS, because they are one rule on two lines of one
 * object: the pair that drifted would be a `kind` bounded while the `group`
 * beside it was not, which is exactly the state CNCORE-284 was filed over.
 *
 * AND IT LIVES IN A MODULE OF ITS OWN, IMPORTING NOTHING, which is a fact about
 * who READS it rather than a second opinion about where ceilings go. `A_PAGE`
 * is read by six listings and all six are inside `@canoncore/api`, so it stays
 * where its own docblock argues it should. This ceiling is read at THREE seams
 * in two packages -- two routers that refuse a direct caller, and
 * `oneKind`/`oneGroup` in `apps/web` that bound the reader -- and the web module
 * holding those is imported by `scope.tsx`, which is a CLIENT component.
 *
 * SO THE FILE IT SITS IN IS THE WHOLE POINT, AND IT WAS MEASURED RATHER THAN
 * REASONED ABOUT. Reaching the number through `@canoncore/api/routers` would
 * pull the router, its database and its oRPC server into the browser bundle to
 * read an integer -- and putting it in `index.ts` beside the schemas pulled ZOD
 * there instead, which is the same mistake one package along. Measured on this
 * tree 2026-09-21, `pnpm --filter web build`, counting `.next/static/chunks`:
 * 972 KB and no zod marker with the import removed, 1356 KB with
 * `ZodError`, `invalid_type` and `parseAsync` in a client chunk once
 * `query-params.ts` imported `@canoncore/schemas`. **384 KB to read an
 * integer.** `index.ts` re-exports it for the two routers, which take zod
 * anyway; `apps/web` imports `@canoncore/schemas/narrowing` and takes nothing.
 *
 * NOT `@canoncore/text`, THE OTHER LEAF IN REACH, and its own words are why:
 * "THE CEILINGS DO NOT LIVE HERE ... each stays beside the sentences it bounds"
 * (ADR-0163). A narrowing bounds no sentence, so it has no business in the
 * package built for the ones that do.
 *
 * ### The number is 100, and it is taken for the SHAPE of the value
 *
 * A kind is a short lower-case slug and `item_kinds.kind` is `text` (migration
 * 1), so no column decides this: the number is a fact about what a kind IS.
 * ADR-0005 closes the set at seven, so the headroom is for a migration renaming
 * one rather than for a set that grows. A Group id is a uuid at 36. 100 is far
 * above both and far below a flood.
 *
 * **ADR-0182 HOLDS THE MEASUREMENT AND THE QUERY, AND THIS DOES NOT REPEAT
 * THEM.** `corpus-figures.test.ts` guards figures in `docs/adr/` and nothing
 * guards a copy in source, so a second copy here would be one that could drift
 * unreported -- which is ADR-0153's own concern, arriving at the constant
 * rather than at the record. Found in review of this pass.
 *
 * **AND IT REACHES FURTHER THAN THE NARROWING IT IS NAMED FOR.** `oneGroup` has
 * six callers, and three of them are not a Listing's scope: `/groups` reads
 * `?delete=` through it, `/import` reads the Group whose Providers are asked,
 * and `scope.tsx` reads the picker's own parameter. All three gain this ceiling
 * and none is harmed by it -- every value they carry is a uuid at 36 -- but the
 * reach is written down because it is not what the NAME says. Found in review
 * of this pass; ADR-0182 names it too.
 *
 * **IT IS `task.ts`'s `KEY_LENGTH` BY ITS NUMBER AND NOT BY ITS REASON, AND THE
 * DIFFERENCE MATTERS.** That ceiling bounds a key because the key is QUOTED BACK
 * in a refusal -- an ADR-0123 sentence bound, where an unbounded value is a
 * caller choosing the length of a sentence this app utters. A narrowing is
 * quoted in no sentence: CNCORE-281 took `?kind=` out of the front page's
 * heading and CNCORE-262 took it out of `/search`'s, and `bounded-parameters`
 * now reports a surface that puts it back. So the same number is taken for the
 * same SHAPE -- a short slug a caller names -- and a later reader must not infer
 * from the agreement that a narrowing gets printed anywhere.
 */
export const A_NARROWING = 100;
