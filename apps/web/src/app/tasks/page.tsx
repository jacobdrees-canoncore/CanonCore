import { appRouter, type ReportedRun as Run } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import { call } from "@orpc/server";
import Link from "next/link";

import { callerContext } from "@/session";

import { cancelTask, runTask } from "./actions";

/**
 * WHERE RECURRING WORK IS VISIBLE (ADR-0049, CNCORE-119).
 *
 * THAT RECORD'S MINIMUM IS THIS PAGE. "A recurring job whose result nobody can
 * see is one that silently stopped months ago" is its own sentence, and every
 * other part of this ticket -- the keyed tasks, the run history, the trigger --
 * exists so that there is something true to put here.
 *
 * NOT A READ, WHATEVER IT LOOKS LIKE. ADR-0044 leaves the CATALOGUE open,
 * because the demo is read-only with no login and ADR-0072 gives a visitor
 * everything on it. What maintenance an instance runs, when, and what broke
 * last night is not in the catalogue -- so a visitor here is told where the
 * door is and nothing else, exactly as `/devices` does.
 *
 * IT NEEDS NO JAVASCRIPT, like every other form in this app: Run and Cancel are
 * ordinary form posts and the answer is the re-rendered list.
 */
export default async function TasksPage() {
  const context = await callerContext();
  if (context.session === null) return <NotLoggedIn />;

  const tasks = await call(appRouter.task.list, {}, { context });
  /*
   * THE HISTORY BESIDE THE LIST, because ADR-0049 asks for a run history rather
   * than a last outcome: a sweep that failed last night reads the same as one
   * that has failed every night for a fortnight, and those are a glitch and a
   * broken machine. One read per task, which is one today and is the same
   * number of round trips the list already makes.
   */
  const histories = new Map(
    await Promise.all(
      tasks.map(
        async (task) =>
          [task.key, await call(appRouter.task.history, { key: task.key }, { context })] as const,
      ),
    ),
  );

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-medium">Tasks</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        The work this catalogue does for itself. Each one runs on its own schedule, and you can run
        one now or stop one that is running.
      </p>
      <p className="mt-2 text-muted-foreground text-sm">
        Nothing here is needed for your catalogue to answer correctly. A task that has not run
        leaves rows that are ignored rather than a door open.
      </p>
      <section aria-labelledby="tasks" className="mt-6">
        <h2 className="sr-only" id="tasks">
          What this catalogue runs
        </h2>
        <ul className="flex flex-col divide-y">
          {tasks.map((task) => (
            <li className="flex items-center justify-between gap-4 py-3" key={task.key}>
              <div>
                <p className="text-sm">{task.name}</p>
                <p className="text-muted-foreground text-xs">{whenItRuns(task.trigger)}</p>
                <p className="text-muted-foreground text-xs">{lastRunOf(task.lastRun)}</p>
              </div>
              {task.lastRun?.outcome === "running" ? (
                <form action={cancelTask}>
                  <input name="key" type="hidden" value={task.key} />
                  <Button size="sm" type="submit" variant="outline">
                    Stop it
                  </Button>
                </form>
              ) : (
                <form action={runTask}>
                  <input name="key" type="hidden" value={task.key} />
                  <Button size="sm" type="submit" variant="outline">
                    Run it now
                  </Button>
                </form>
              )}
              {/*
                WHAT IT DID BEFORE, which is what turns one outcome into a
                pattern. Folded away because the last run is the answer most
                readings want, and `details` needs no JavaScript to open.
              */}
              <Runs runs={(histories.get(task.key) ?? []).slice(1)} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/**
 * The runs before the last one, or nothing at all when there are none.
 *
 * IT RENDERS NOTHING RATHER THAN AN EMPTY DISCLOSURE for a task that has run
 * once or never: a control that opens onto nothing is a reader's wasted press.
 */
function Runs({ runs }: { runs: Run[] }) {
  if (runs.length === 0) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-muted-foreground text-xs">
        {runs.length === 1 ? "The run before it" : `The ${runs.length} runs before it`}
      </summary>
      <ul className="mt-1 flex flex-col gap-1">
        {runs.map((run) => (
          <li className="text-muted-foreground text-xs" key={run.startedAt.toISOString()}>
            {lastRunOf(run)}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * A trigger in words.
 *
 * IN THE SERVER'S OWN ZONE AND SAID SO, which is the opposite of what
 * `/devices` does with a timestamp and is right for the opposite reason. A
 * SIGHTING happened at a moment, and a moment is the same instant everywhere,
 * so that page prints UTC; a SCHEDULE is a wall-clock instruction to this
 * machine, and "three in the morning" means three where the machine thinks it
 * is. Printing that in UTC would tell an owner in Sydney their sweep runs at
 * lunchtime when it does not.
 */
function whenItRuns(trigger: { kind: "daily"; atHour: number }): string {
  return `Every day at ${String(trigger.atHour).padStart(2, "0")}:00, this server's time`;
}

/**
 * The last thing a task did, in a sentence.
 *
 * NEVER RUN IS ITS OWN SENTENCE. A task with no runs is not a task that ran and
 * found nothing, and rendering the two alike would report the silent stoppage
 * this page exists to surface as health.
 *
 * EACH OUTCOME READS DIFFERENTLY because ADR-0049 says two of them must: a job
 * that was STOPPED and a job that BROKE need different answers, so they are
 * different sentences here rather than one shared "did not finish".
 *
 * AND THE OWNER'S OWN DECISION IS NOT THE SERVER DYING, which is the third
 * value Jellyfin ships: "You stopped it" is something they did, and "the server
 * stopped" is something that happened to the machine. Only the second is worth
 * going to look at.
 *
 * IT TAKES THE PACKAGE'S OWN TYPE rather than restating the shape, which an
 * earlier version did here and in the router both -- a union written down twice
 * is two lists to add a value to, and the forgotten one fails as a page
 * rendering an outcome it has no word for. Found in review.
 */
function lastRunOf(run: Run | null): string {
  if (run === null) return "Has not run yet.";
  if (run.outcome === "running") return `Running, started ${on(run.startedAt)}.`;

  const when = run.endedAt === null ? on(run.startedAt) : on(run.endedAt);
  const said = run.detail ?? "It said nothing.";
  if (run.outcome === "completed") return `${said} Ran ${when}.`;
  if (run.outcome === "failed") return `Failed ${when}. ${said}`;
  // THE OWNER'S OWN DECISION READS BACK AS ONE. "Stopped" is what they did;
  // "the server stopped" is something that happened to the machine, and only
  // the second is worth going to look at.
  if (run.outcome === "cancelled") return `You stopped it ${when}.`;
  return `The server stopped ${when}, while this was running.`;
}

/**
 * A moment, in UTC and said so.
 *
 * THE SERVER CANNOT KNOW THE READER'S TIMEZONE, and this page is rendered on
 * the server with no script to correct it afterwards -- the reasoning
 * `/devices` records at greater length. A past moment is the same instant
 * everywhere, so UTC is a statement a reader can convert; the SCHEDULE above is
 * the one thing on this page that is not.
 */
function on(moment: Date): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(moment)} UTC`;
}

/** ADR-0044's visitor, told where the door is and nothing else. */
function NotLoggedIn() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-medium">Tasks</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        What a catalogue does for itself, and when it last did it, is its owner&apos;s business. So
        this page asks you to be them first.
      </p>
      <Link className="mt-6 inline-block text-sm hover:underline" href="/login">
        Log in
      </Link>
    </main>
  );
}
