import { flatten } from "./flatten";

/**
 * A document cut into BLOCKS -- paragraphs, bullets, headings, table rows.
 *
 * THE BLOCK IS WHAT BOUNDS A WINDOW, and it had to be, because `flatten` eats
 * newlines and markdown does not end a bullet or a heading with a full stop.
 * Measured on this tree before the fix: splitting the whole flattened document
 * gave ADR-0162 a 634-character "sentence", and 7 of its 52 fragments had a
 * `## ` heading swallowed mid-string. A hazard in an unterminated bullet would
 * then make "the sentence and the ones beside it" span the rest of the file --
 * the document-level check every caller here refuses. The guarantee was
 * accidental before this; now it is structural.
 *
 * A NEW BLOCK OPENS on a blank line, a list marker, a heading, or a table row,
 * because each of those is a place markdown changes subject without punctuation.
 *
 * A MODULE OF ITS OWN SINCE CNCORE-327, on `flatten.ts`'s and `repo-root.ts`'s
 * reason (CNCORE-58). `terminal-send-hazards.test.ts` measured this cutter and
 * wrote the paragraphs above; the corpus-cost check needs the IDENTICAL cut,
 * over a wider population. What is worth one home is not the expression but the
 * measurements -- a second copy is a second place for the reason to be lost, and
 * `tracked-files.ts` carries this tree's specimen of what that costs: two
 * suites holding the identical read, one guard, no comment saying why.
 */
export function blocksOf(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  const close = (): void => {
    if (current.length > 0) blocks.push(current.join("\n"));
    current = [];
  };
  for (const line of text.split("\n")) {
    if (line.trim() === "" || /^\s*(?:[-*+]\s|\d+\.\s|#{1,6}\s|\|)/.test(line)) close();
    if (line.trim() !== "") current.push(line);
  }
  close();
  return blocks;
}

/**
 * The abbreviations this corpus actually writes, which a full stop does not end
 * a sentence after.
 *
 * MEASURED, NOT IMAGINED, and both directions were reproduced before this
 * existed. A false SPLIT reddens prose that is correct: "`ctrl+x ctrl+s`
 * flushes it, e.g. on a rung broadcast. It interrupts the turn." cuts after
 * `e.g.` and leaves a flush claim with no cost clause. A false split also lets
 * a claim ESCAPE in silence: "Flush it with `ctrl+x ctrl+s`, i.e. Escape then
 * Enter. That flushes it." puts the recipe in one fragment and `flushes it` in
 * another, so no fragment is a claim at all and the population guard still
 * passes because other claims remain. The second is the worse one, which is why
 * this is a guard and not a tidy-up.
 */
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|cf|vs|viz|al|no|fig|mr|mrs|ms|dr|st)\.$/i;

/**
 * One block's sentences.
 *
 * FLATTENED FIRST because every document here is hard-wrapped at 100 columns,
 * so a claim and its cost routinely sit either side of a newline --
 * `flatten.ts` carries the measurement of what matching raw bytes cost
 * `adr-as-built.test.ts`. Flattening a BLOCK rather than the document is what
 * keeps that fix from buying a false join.
 */
export function sentencesOf(block: string): string[] {
  const sentences: string[] = [];
  for (const fragment of flatten(block).split(/(?<=[.!?])\s+/)) {
    const previous = sentences.at(-1);
    if (previous !== undefined && ABBREVIATION.test(previous)) {
      sentences[sentences.length - 1] = `${previous} ${fragment}`;
    } else {
      sentences.push(fragment);
    }
  }
  return sentences;
}

/**
 * A source file with the COMMENT LEADER taken off every line, so a sentence
 * wrapped inside a docblock reads as one sentence.
 *
 * THE SAME STEP `tree-figures.ts` TAKES, and for the same reason it states: a
 * claim wrapped at 100 columns inside JSDoc has ` * ` inserted mid-sentence, so
 * a pattern written against the prose does not match it. That module keeps the
 * step private because it flattens whole files; this one hands back TEXT so a
 * caller can still cut it into blocks, which is the shape a windowed check
 * needs.
 *
 * MARKDOWN IS LEFT ALONE, because `#` opens a heading there and `*` opens a
 * bold span, and stripping either would rewrite the document being read.
 *
 * `--` IS STRIPPED TOO, WHICH `tree-figures.ts` HAS NO CALLER FOR. It is SQL's
 * line comment, and the migration ladder is the one population whose prose is
 * unamendable (ADR-0047): a rung's sentences can only ever be READ, so a reader
 * that cannot see into them is a reader blind to the one place a correction
 * can never land.
 *
 * `//` IS STRIPPED AT THE LINE START ONLY, because `https://` is two of the
 * same characters in the middle of a word.
 */
export function withoutCommentLeaders(path: string, text: string): string {
  if (path.endsWith(".md")) return text;
  return text
    .replace(/^[ \t]*\/\*+[ \t]?/gm, "")
    .replace(/^[ \t]*\/\/[ \t]?/gm, "")
    .replace(/^[ \t]*--[ \t]?/gm, "")
    .replace(/^[ \t]*(?:\*|#)[ \t]?/gm, "");
}
