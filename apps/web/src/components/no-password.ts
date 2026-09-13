/**
 * WHAT AN INSTANCE WITH NO PASSWORD SAYS ABOUT ITSELF, IN ONE PLACE
 * (CNCORE-146).
 *
 * ADR-0044's read-only instance sets no `OWNER_PASSWORD`, so `session.logIn`
 * refuses every password and nobody obtains a session INCLUDING the owner. Seven
 * surfaces have to say that: `/login`, which refuses to render a form; the empty
 * catalogue; `/new`; `/import`; `/tasks`; `/settings`; `/devices`. It is one
 * fact, so it is one sentence.
 *
 * IT IS HERE BECAUSE THE COPIES HAD ALREADY DRIFTED, which is the whole
 * argument and is not hypothetical. `/login` said "nothing can be CHANGED
 * through it" and the empty state said "nothing can be ADDED through it" -- and
 * the empty state's own comment, ADR-0094, and CNCORE-144's first draft of
 * `/new` all described the second as "the words `/login` uses". Three claims
 * that a sentence matched another surface's, written while it did not.
 *
 * TWO COPIES WERE ENOUGH TO DRIFT, AND CNCORE-146 WOULD HAVE MADE SEVEN. That
 * is the arithmetic that decided this: the five surfaces below each needed the
 * sentence, and writing it out five more times would have taken a pair that had
 * already disagreed and multiplied it. Review caught the third false claim in
 * the diff that was about to add the rest.
 *
 * THE VERB IS THE ARGUMENT BECAUSE IT IS THE ONLY THING THAT REALLY VARIES.
 * `/new` and the empty catalogue are about FILLING a catalogue, where "added"
 * is the precise word; the operational surfaces are about changing an instance,
 * where it is "changed". Both were already in use and both are right where they
 * are, so the parameter preserves them rather than flattening one onto the
 * other. What cannot drift now is the clause before it, which is the part every
 * surface was claiming to share.
 *
 * A STRING RATHER THAN A COMPONENT, so each surface keeps its own element and
 * its own place in its own layout: this is a `<p>` on four pages, part of a
 * longer paragraph on `/login`, and a fragment inside a sentence on `/`. A
 * component would have had to render one of those and be wrong on the rest.
 */
export function noPasswordSet(nothingCanBe: "added" | "changed"): string {
  return `This instance has no password set, so nobody can log in and nothing can be ${nothingCanBe} through it.`;
}
