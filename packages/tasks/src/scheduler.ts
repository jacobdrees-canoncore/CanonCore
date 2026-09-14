import type { Database } from "@canoncore/db";

import type { Registry, Trigger } from "./registry";

/**
 * When this trigger next fires, strictly after the moment given.
 *
 * STRICTLY AFTER, which is what stops a fired task scheduling itself again: the
 * task that has just run at three asks this question at three, and an answer of
 * "three" is a loop rather than a daily task.
 *
 * IN THE MACHINE'S OWN LOCAL TIME, by the `Date` constructor that takes parts.
 * That constructor is also what makes this correct across a month end and
 * across a daylight-saving change without arithmetic of its own -- asking for
 * "the 32nd of September at 3" answers the 2nd of October at 3, and asking for
 * three in the morning on the day the clocks go forward answers three in the
 * morning, rather than a fixed number of milliseconds that lands at two or at
 * four.
 */
export function nextFiring(trigger: Trigger, after: Date): Date {
  const today = new Date(
    after.getFullYear(),
    after.getMonth(),
    after.getDate(),
    trigger.atHour,
    0,
    0,
    0,
  );
  if (today.getTime() > after.getTime()) return today;
  return new Date(
    after.getFullYear(),
    after.getMonth(),
    after.getDate() + 1,
    trigger.atHour,
    0,
    0,
    0,
  );
}

/**
 * Starts firing this registry's triggers, and answers the thing that stops it.
 *
 * A TIMER PER TASK, RE-ARMED AFTER EACH FIRING, rather than one clock tick that
 * asks every task whether it is due. A polling loop has to decide how often to
 * wake and then decide what "due" means within that window -- which is how a
 * task gets run twice in one minute, or missed because the wake landed either
 * side of its hour.
 *
 * IT CLOSES THE RUNS LEFT OPEN FIRST. This runs when the process starts, and
 * the rows a killed process left behind are the only things that can say what
 * happened the night it died. Doing it before the first trigger is armed means
 * the history is honest from the first moment anything can read it.
 *
 * A FIRING THAT BREAKS DOES NOT STOP THE SCHEDULE. `registry.run` reports a
 * broken task as an outcome rather than raising, and a task already running is
 * refused -- the refusal is swallowed here on purpose, because the owner
 * running a sweep by hand at three in the morning is not an incident, and the
 * run they started is in the history either way.
 *
 * IT IS THIS PROCESS'S SCHEDULE AND NOT THE INSTANCE'S. Two servers on one
 * database would each fire every trigger; ADR-0109 commits to a shape with one
 * process that something restarts, and `closeTaskRunsLeftOpen` records the same
 * assumption from the other end.
 */
export async function startScheduler(registry: Registry, db: Database): Promise<() => void> {
  await registry.closeRunsLeftOpen(db);

  const timers = new Set<ReturnType<typeof setTimeout>>();
  let stopped = false;

  const arm = (task: { key: string; trigger: Trigger }, from: Date) => {
    if (stopped) return;
    const due = nextFiring(task.trigger, from);
    const timer = setTimeout(() => {
      timers.delete(timer);
      // RE-ARMED BEFORE THE RUN RATHER THAN AFTER IT. A sweep that takes an
      // hour would otherwise push tomorrow's firing an hour later every day,
      // and a task that never returns would end the schedule silently.
      //
      // AND FROM THE MOMENT IT WAS DUE RATHER THAN FROM THE CLOCK NOW, which
      // is not the same moment: MEASURED on this machine, `setTimeout` fired
      // BEFORE its deadline 34 times in 2000, by up to a millisecond. Reading
      // the clock here on one of those would compute tonight's hour as still
      // ahead and arm again for a millisecond's time -- two firings for one
      // night. `due` is exact, so the next one is tomorrow whenever the
      // callback actually ran.
      //
      // IT IS THE OVERLAP GUARD THAT MAKES TODAY'S VERSION HARMLESS, and that
      // is the reason to fix it rather than to leave it: the second firing is
      // refused only because the first is still waiting on a database round
      // trip, which is a coincidence rather than a rule, and a task that never
      // touches the database would run twice.
      arm(task, due);
      void registry.run(db, task.key).catch(() => {
        // Every ending a run can HAVE is already written to the history by
        // `registry.run`, so what reaches here is one of the two things that
        // never became a run: the refusal of a task already running, and a
        // firing whose opening write itself failed.
        //
        // AND THE SECOND ONE HAS NOWHERE ELSE TO GO. The history is the only
        // place this app records what a task did, and a run that could not be
        // opened is one the database refused to hold a row for -- so the
        // surface that would carry the report is the thing that just failed.
        // What makes that survivable is that it no longer strands the key
        // (CNCORE-162): the next firing tries again rather than being refused
        // for the life of the process.
      });
    }, due.getTime() - Date.now());
    timers.add(timer);
  };

  const startingNow = new Date();
  for (const task of registry.tasks) arm(task, startingNow);

  return () => {
    stopped = true;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
}
