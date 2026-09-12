import { SOURCE_MARK_PX } from "./marks";

/**
 * One source's obligation, in the shape the read path emits it.
 *
 * WRITTEN OUT RATHER THAN IMPORTED FROM `@canoncore/schemas`, which is the same
 * choice the item page already makes and for its reason: the app takes what it
 * renders from the read path and names one fewer dependency for it. The read
 * path's own `attributionPublic` is the contract; this is a structural echo of
 * it, and the page passes the real thing straight in, so a field renamed there
 * fails the typecheck here.
 */
export interface AttributionOnThePage {
  sourceLabel: string;
  notice: string;
  logo: { dataUri: string; alt: string } | null;
}

/**
 * What this page owes for showing what it shows.
 *
 * ADR-0036: TMDB's terms require their notice "prominently in or on Your
 * Application" and require their logo be shown at all. ADR-0033 is why neither
 * is written here: a third party's licence terms stay DECLARED FIELDS, so the
 * provider hands over the words and the mark and this renders whatever it is
 * given. Nothing in this file knows it is looking at TMDB, and a second source
 * with its own obligation needs no change here.
 *
 * IT RENDERS NOTHING FOR AN ITEM THAT OWES NOTHING, which is the ordinary case:
 * the owner's own claims and the archive's oblige nobody. An empty bordered strip
 * saying "Sources" would be markup for the common case built to serve the rare one.
 *
 * THE NOTICE IS PRINTED VERBATIM. It is not truncated, not title-cased, and not
 * wrapped in words of ours -- a paraphrased licence notice breaches the licence as
 * surely as a missing one, and every transformation available here is a paraphrase.
 */
export function Attribution({ attribution }: { attribution: AttributionOnThePage[] }) {
  if (attribution.length === 0) return null;

  return (
    <section className="mt-10 border-t pt-4" aria-labelledby="attribution">
      <h2 id="attribution" className="font-medium text-sm">
        Sources
      </h2>
      <ul className="mt-3 space-y-3">
        {attribution.map((owed) => (
          // TODO(CNCORE-130): a label is not an identity, so two sources sharing
          // one and each owing a notice are two siblings with one key.
          <li key={owed.sourceLabel} className="flex items-center gap-3">
            {owed.logo && (
              /*
               * An `img` rather than the SVG inlined into the document, and that
               * is a safety decision rather than a stylistic one. These bytes came
               * from a provider, and an SVG inlined into the page can carry script
               * while the same bytes loaded through `img` are rendered with
               * scripting disabled.
               *
               * `height` as an ATTRIBUTE rather than a class, because the licence
               * obligation is that this mark is less prominent than ours -- so the
               * number belongs in the HTML where it can be read back and compared,
               * not in a utility class where the comparison lives in somebody's
               * head. `marks.ts` holds both halves of it.
               *
               * `width: auto` so a wordmark keeps its aspect ratio; the source
               * chose its own artwork and we are not reshaping it.
               *
               * Next's `Image` is deliberately not used: it optimises and serves
               * from a loader, and a `data:` URI has nothing to fetch and nothing
               * to optimise.
               */
              <img
                src={owed.logo.dataUri}
                alt={owed.logo.alt}
                height={SOURCE_MARK_PX}
                style={{ height: `${SOURCE_MARK_PX}px`, width: "auto" }}
              />
            )}
            {/* Verbatim, and the only styling is the size every other note on
                this page is set in. */}
            <p className="text-muted-foreground text-sm">{owed.notice}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
