import type { AppRouterClient } from "./routers";

/**
 * What the Owner hands over: a Provider, and the Container ids to import from
 * it.
 *
 * THE IDS ARE SUPPLIED RATHER THAN ENUMERATED, and that is ADR-0033 rather than
 * a gap here. `browse` takes one Container id, and while CMPP declares an
 * operation answering "which Containers do you have" since CNCORE-185, no
 * Provider answers it yet -- so there is still nothing to ask. The wiki Provider
 * already enumerates the corpus for its own measurement, so the list exists -- it
 * just does not travel over CMPP.
 */
export interface ContainerList {
  /** The Provider's base URL, which for a Provider IS its identity (ADR-0031). */
  baseUrl: string;
  /** The Provider's own ids, in the order they are to be imported. */
  containerIds: string[];
}

/**
 * The Container ids in a file the Owner wrote, one a line.
 *
 * IT IS HERE AND TESTED RATHER THAN THREE LINES INSIDE A SCRIPT, because a run
 * is resumed by matching the LIST it is walking. A reader that answered a
 * different list for the same file -- one trailing newline, one stray space --
 * would not resume: it would open a second run over all 465 Containers and
 * browse every one of them again, silently, at five and a half hours. The
 * failure is invisible at the moment it happens and expensive afterwards, which
 * is the definition of something to put behind a test.
 *
 * BLANK LINES AND `#` COMMENTS GO, because a list of 465 Provider ids is
 * unreadable without notes beside them: the ids are the Provider's own and
 * nothing else on the line says what a timeline is.
 */
export function theContainerIdsIn(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/** One Container's outcome, as the walk reports it the moment it happens. */
export type SteppedContainer = Extract<
  Awaited<ReturnType<AppRouterClient["provider"]["importNextContainer"]>>,
  { containerId: string }
>;

/** A run and every Container of it, in the order the Owner listed them. */
export type ImportRunReport = Awaited<ReturnType<AppRouterClient["provider"]["readImportRun"]>>;

/**
 * What the walk found waiting for it: a fresh run, or one it is carrying on.
 *
 * SAID BEFORE THE FIRST BROWSE, because the first browse is 43.8s away and a
 * resume that announced itself only by what it did NOT do would leave the Owner
 * watching a silent terminal wondering whether their list had been read at all.
 */
export interface OpenedRun {
  runId: string;
  /** How many of the list already landed, which is what a resume is not doing again. */
  landed: number;
  /** How many are still to be asked for. */
  toAskFor: number;
}

export interface WalkingTheList {
  onOpened?: (run: OpenedRun) => void;
  onStepped?: (step: SteppedContainer) => void;
}

/**
 * Imports a list of Containers from one Provider, one at a time, resumably
 * (CNCORE-166).
 *
 * IT TAKES A CLIENT RATHER THAN A DATABASE, and that is the one decision this
 * function embodies. The Owner's install publishes NO database port -- only the
 * app talks to Postgres, which `compose.yaml` states as a decision rather than
 * an omission -- so the only route into a running instance is its own API. This
 * drives that API, which means the same function fills the Owner's install, a
 * stranger's, or a test's in-process router with nothing swapped out.
 *
 * ONE AT A TIME, AND THE `await` IS THE WHOLE MECHANISM. `importNextContainer`
 * answers the Container it did, so which one is next is a question only the run
 * can answer once this one is recorded -- there is nothing here to parallelise
 * even by accident. That is not tidiness: `provider-wiki` is one Node process,
 * and two concurrent browses of the largest Ordering were measured at 49.1s each
 * against 25.5s alone (2026-09-13), so asking twice at once is slower as well as
 * ruder.
 *
 * IT HOLDS NO POSITION OF ITS OWN. Where the walk has got to is rows (migration
 * 18), so this function is free to die at Container 200 of 465: the next call
 * with the same list carries on from 201 rather than from the beginning, and
 * five and a half hours of browsing is not something to ask an Owner to spend
 * twice.
 *
 * A REFUSAL DOES NOT STOP IT. One Container the Provider will not answer for is
 * one Container, and the 464 after it are still worth asking for -- the reason
 * is written down against the Container that refused, and the report at the end
 * is where the Owner reads which ones those were.
 */
export async function importContainerList(
  client: AppRouterClient,
  { baseUrl, containerIds }: ContainerList,
  { onOpened, onStepped }: WalkingTheList = {},
): Promise<ImportRunReport> {
  const opened = await client.provider.beginImportRun({ baseUrl, containerIds });
  const landed = opened.containers.filter((container) => container.outcome === "landed").length;
  onOpened?.({
    runId: opened.runId,
    landed,
    toAskFor: opened.containers.length - landed,
  });

  for (;;) {
    const stepped = await client.provider.importNextContainer({ runId: opened.runId });
    if (stepped.answer === "done") break;
    onStepped?.(stepped);
  }

  // THE RUN IS WHAT REPORTS, rather than a total this function accumulated. A
  // resumed walk steps only over what had not landed, so a tally kept here would
  // describe the attempt rather than the import -- and the Owner's question is
  // "is my corpus in", not "what did this hour do".
  return client.provider.readImportRun({ runId: opened.runId });
}
