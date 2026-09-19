/**
 * A count and the thing it counts, agreeing about number.
 *
 * THE COUNTS ARE THE CONTENT of the surfaces that print them rather than
 * decoration on them -- the purge's confirmation and a Group's (ADR-0046) -- so
 * "1 statements" is not a typo an owner reads past. It is the one part of a
 * permanent delete they have to trust, printed by something that plainly did
 * not read what it was printing.
 */
export function counted(howMany: number, noun: string): string {
  return `${howMany} ${noun}${howMany === 1 ? "" : "s"}`;
}
