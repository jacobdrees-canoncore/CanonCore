import {
  closeTaskRunsLeftOpen,
  type Database,
  endTaskRun,
  readLatestTaskRuns,
  readTaskRuns,
  startTaskRun,
  type TaskOutcome,
  type TaskRun,
} from "@canoncore/db";

export type { TaskOutcome, TaskRun } from "@canoncore/db";

/**
 * WHEN A TASK RUNS WITHOUT BEING ASKED (ADR-0049).
 *
 * A NAMED TRIGGER TYPE RATHER THAN RAW CRON, which is that record's own
 * instruction and Jellyfin's shape. Cron is five fields of which four are
 * usually `*`, and every one of them is a way for an owner to write a schedule
 * that runs something every minute of a Tuesday by accident. A named trigger
 * can only express schedules this app is willing to keep.
 *
 * ONE KIND TODAY, and the union is how a second arrives without every reader
 * having to change. Jellyfin carries four -- daily, weekly, interval and
 * startup -- and the eight tasks ADR-0049 lists will want more than one of
 * them; a task that needs one is what earns it, rather than this file guessing
 * which three.
 */
export type Trigger = { kind: "daily"; atHour: number };

/**
 * EVERY NIGHT AT THIS HOUR, by the clock of the machine the catalogue runs on.
 *
 * THE OWNER'S OWN MIDNIGHT AND NOT UTC. Maintenance is scheduled for the small
 * hours because that is when nobody is reading, and "nobody is reading" is a
 * fact about where the owner lives rather than about Greenwich. Plex picks a
 * 3am-6am window for the same reason and in the same zone.
 */
export function dailyAt(hour: number): Trigger {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`a daily trigger fires at an hour from 0 to 23, not ${hour}`);
  }
  return { kind: "daily", atHour: hour };
}

/** What a task is handed when it runs. */
export interface TaskContext {
  db: Database;
  /**
   * STOPPED, when the owner asks. ADR-0049 requires a running task be
   * cancellable, and cancelling is COOPERATIVE because nothing else is
   * available: a JavaScript runtime cannot interrupt a promise from outside, so
   * a task that never consults this one runs to its own end. What the registry
   * guarantees is the ANSWER -- the run reads `aborted` from the moment the
   * owner asked, whatever the task does afterwards.
   */
  signal: AbortSignal;
}

/**
 * One piece of recurring work, keyed (ADR-0049).
 *
 * `run` ANSWERS A SENTENCE, and that sentence is the whole of what an owner
 * reads about the run afterwards. "Removed 12 sessions" is a report; a task
 * that answered nothing would leave the history saying only that something
 * happened, which is the visibility this registry exists to provide spent on
 * nothing.
 */
export interface Task {
  /** Stable, and what the history is keyed by: it outlives any renaming. */
  key: string;
  /** What the owner reads on the page. */
  name: string;
  trigger: Trigger;
  run(context: TaskContext): Promise<string>;
}

/**
 * The registry declining to run something, as opposed to a task breaking.
 *
 * THE TWO ARE DIFFERENT FACTS AND ONLY ONE OF THEM IS AN INCIDENT. A task that
 * threw goes in the history as `failed`, because it ran; this never started, so
 * there is nothing to record and the caller is told why instead. `ItemRefused`
 * in `packages/db` draws the same line for the same reason.
 */
export class TaskRefused extends Error {
  /**
   * WHICH REFUSAL THIS IS, because the two are different facts and a surface
   * has to answer them differently. A key this build no longer ships means the
   * page the owner is looking at is stale; a task already running means they
   * pressed Run twice, or the scheduler got there first. One answer for both
   * tells the second owner their task does not exist.
   */
  readonly reason: "no such task" | "already running";

  constructor(reason: "no such task" | "already running", message: string) {
    super(message);
    this.reason = reason;
  }
}

/** ADR-0049's registry, as everything that holds one refers to it. */
export type Registry = ReturnType<typeof createRegistry>;

/** One task as the owner's page reads it. */
export interface ListedTask {
  key: string;
  name: string;
  trigger: Trigger;
  /** `null` when this task has NEVER run, which is not the same as a run that did nothing. */
  lastRun: TaskRun | null;
}

/**
 * ADR-0049's visible registry: keyed tasks, each runnable by hand, with a run
 * history an owner can read.
 *
 * IT TAKES ITS TASKS RATHER THAN READING THEM, which is the shape `createDb`
 * takes in `packages/db` and for the same reason: a test points it at tasks of
 * its own without reaching around the package. It matters more here than there,
 * because two of the three endings this registry has to tell apart -- a task
 * that BROKE and one that was STOPPED -- are things the product's own task does
 * not do on demand.
 */
export function createRegistry(tasks: Task[]) {
  const byKey = new Map(tasks.map((task) => [task.key, task]));
  /**
   * THE RUNS HAPPENING RIGHT NOW, IN THIS PROCESS'S MEMORY, which is the only
   * place they could be: the controller that can stop a promise is the object
   * that created it. A second server would neither see these nor be able to
   * stop them, and the container this app ships in runs one (ADR-0109's shape).
   * `closeRunsLeftOpen` is what makes the rows honest when that process dies.
   */
  const running = new Map<string, AbortController>();

  return {
    /**
     * The tasks this registry carries, for a caller that needs their triggers
     * without asking the database anything -- which the scheduler does, every
     * time it re-arms.
     */
    tasks: tasks as readonly Task[],

    /**
     * Runs one task NOW, and answers the finished run.
     *
     * IT AWAITS THE TASK. Answering the moment the work was started would make
     * every caller poll to find out what happened, and the one surface that
     * runs a task by hand is a form post whose answer is the re-rendered page.
     */
    async run(db: Database, key: string): Promise<TaskRun> {
      const task = byKey.get(key);
      if (!task) throw new TaskRefused("no such task", `No task is keyed ${key}.`);
      // BEFORE THE ROW IS OPENED, so a refused second run leaves no history
      // entry for a run that never ran.
      if (running.has(key))
        throw new TaskRefused("already running", `${task.name} is already running.`);

      const stop = new AbortController();
      running.set(task.key, stop);
      const run = await startTaskRun(db, task.key);
      try {
        const ending = await endingOf(task, { db, signal: stop.signal });
        // THE ROW AS IT WAS STORED, not this copy of the opening plus the
        // ending. `run` is what `startTaskRun` answered, whose `endedAt` is
        // null, so spreading the ending over it produced a run reading
        // `completed` with no end -- the one state the table's own check
        // refuses, and a shape the database would never have held. Found in
        // review, by both axes independently.
        //
        // AND IF SOMETHING ELSE CLOSED IT FIRST -- a restart's startup close,
        // reaching a run whose process was gone -- `endTaskRun` answers the
        // stored row rather than the ending that lost the race.
        return endTaskRun(db, run.id, ending.outcome, ending.detail);
      } finally {
        running.delete(task.key);
      }
    },

    /**
     * Stops a task that is running, and answers whether there was one.
     *
     * THE ANSWER IS DECIDED HERE AND NOT BY WHAT THE TASK DOES NEXT. A task
     * that honours the signal rejects, one that ignores it returns a sentence,
     * and a third throws something unrelated on the way out -- `endingOf`
     * reads the signal rather than the ending, so all three read `aborted`.
     * Recording a cancelled run as `completed` because the task did not look
     * would tell the owner their instruction had no effect AND that everything
     * was fine.
     */
    cancel(key: string): boolean {
      const stop = running.get(key);
      stop?.abort(STOPPED);
      return stop !== undefined;
    },

    /**
     * Every task this instance runs, with the last thing each of them did.
     *
     * IN THE ORDER THEY WERE REGISTERED IN, which is the order this repository
     * wrote them down rather than anything derived. Sorting by name would
     * reshuffle the page every time a task was renamed, and sorting by last run
     * would move the row an owner is looking at while they look at it.
     */
    async list(db: Database): Promise<ListedTask[]> {
      const latest = await readLatestTaskRuns(db, [...byKey.keys()]);
      return tasks.map(({ key, name, trigger }) => ({
        key,
        name,
        trigger,
        lastRun: latest.get(key) ?? null,
      }));
    },

    /**
     * Closes the runs a process that is gone left open, and answers how many.
     *
     * CALLED WHEN THE REGISTRY STARTS, before anything is scheduled. It is the
     * other half of holding the live runs in memory: the map is empty in a new
     * process, so without this the rows those controllers belonged to read as
     * running forever.
     */
    async closeRunsLeftOpen(db: Database): Promise<number> {
      return closeTaskRunsLeftOpen(db, LEFT_OPEN);
    },

    /** One task's runs, newest first. */
    async history(db: Database, key: string): Promise<TaskRun[]> {
      return readTaskRuns(db, key, HISTORY_DEPTH);
    },
  };
}

/**
 * HOW FAR BACK A HISTORY IS READ.
 *
 * A DAILY TASK WRITES 365 ROWS A YEAR and this table only grows, so a history
 * that answered all of them would be a page that gets slower every night it
 * works. Thirty is a month of a daily task -- enough to see that last night
 * failed and that the four before it did not, which is the question ADR-0049
 * says the history is read to answer.
 */
const HISTORY_DEPTH = 30;

/**
 * Runs the task and answers how it ended, rather than raising.
 *
 * A BREAKAGE IS AN OUTCOME HERE, NOT AN EXCEPTION. ADR-0049 wants last night's
 * failure VISIBLE, and a throw that reached the scheduler would end the
 * scheduler -- so tomorrow's run would be missing too, and the history would
 * record neither. Everything this catches is written down instead.
 */
async function endingOf(
  task: Task,
  context: TaskContext,
): Promise<{ outcome: Exclude<TaskOutcome, "running">; detail: string }> {
  try {
    const detail = bounded(await task.run(context));
    return context.signal.aborted ? stopped() : { outcome: "completed", detail };
  } catch (thrown) {
    return context.signal.aborted
      ? stopped()
      : { outcome: "failed", detail: bounded(reasonFor(thrown)) };
  }
}

/** THE SIGNAL DECIDES, so every way out of a stopped run reads the same. */
function stopped(): { outcome: "cancelled"; detail: string } {
  return { outcome: "cancelled", detail: STOPPED };
}

/** What a run the owner stopped leaves in the history. */
const STOPPED = "Stopped before it finished.";

/** What a run the server died under leaves in the history. */
const LEFT_OPEN = "The server stopped while this was running.";

/** What a thrown value says, for a reader who cannot see the stack. */
function reasonFor(thrown: unknown): string {
  return thrown instanceof Error ? thrown.message : String(thrown);
}

/**
 * The sentence a run leaves behind, CAPPED.
 *
 * BECAUSE NOTHING THAT REACHES HERE CHOSE ITS OWN LENGTH. A task answers a
 * sentence it wrote, but what a task THROWS is written by whatever broke --
 * Postgres quoting the statement back, a provider's body under ADR-0123, zod
 * listing an issue per bad field. ADR-0123 measured that last one at 378,782
 * characters, and this column is read onto a page.
 *
 * COLLAPSED BEFORE IT IS CUT, which that record also learned the hard way: a
 * pretty-printed error spends the whole allowance on its own indentation and
 * hands the reader a stack of braces.
 *
 * 300 IS ADR-0123's NUMBER, taken rather than chosen again, because this is the
 * same question that record answered about a different reader.
 */
function bounded(detail: string): string {
  const collapsed = detail.replace(/\s+/g, " ").trim();
  return collapsed.length <= BOUNDED_DETAIL
    ? collapsed
    : `${collapsed.slice(0, BOUNDED_DETAIL - 1)}\u2026`;
}

export const BOUNDED_DETAIL = 300;
