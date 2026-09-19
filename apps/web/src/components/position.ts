/**
 * Where a placement sits, in the reader's words.
 *
 * A MEMBER WITH NO POSITION IS STILL A MEMBER (migration 2), and this is where
 * a reader meets one: the source put the item in this container and said
 * nothing about where. Printing `#null` would be the model leaking, and leaving
 * the row out would hide a membership that is real.
 *
 * The words say what is absent rather than guessing at it, because the two
 * other answers -- dropping the row, or numbering it last -- each assert
 * something no source ever claimed.
 *
 * SHARED SINCE CNCORE-184 by a third surface, the catalogue Row, which is why it
 * left the item page: three places saying where a placement sits are three
 * places the same absence could come to be described differently. The Row
 * prints it mid-sentence and lowers its case; the words stay written once.
 */
export function positionLabel(position: number | null): string {
  return position === null ? "No position given" : `#${position}`;
}
