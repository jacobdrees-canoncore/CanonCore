import { describe, expect, inject, it } from "vitest";

import {
  documentFrom,
  logInAt,
  mainOf,
  momentsIn,
  postFormsIn,
  sectionIn,
  submit,
} from "./document";

/**
 * ADR-0049's VISIBLE registry, over real HTTP (CNCORE-119).
 *
 * THE PAGE IS WHAT MAKES THE RECORD'S MINIMUM TRUE. "Last night's failure is
 * VISIBLE" is that record's own sentence, and a run history readable only by a
 * procedure is one an owner never looks at -- which is the maintenance job that
 * silently stopped months ago, with a table behind it this time.
 *
 * NO BROWSER, like every other file here: Run and Cancel are ordinary form
 * posts, so a browser with no script does exactly what this does.
 */
const baseUrl = inject("baseUrl");
const ownerPassword = inject("ownerPassword");
/**
 * ADR-0044's read-only instance, which sets no `OWNER_PASSWORD`: every password
 * is refused, so nobody obtains a session INCLUDING the owner. This page is the
 * owner's whole, so on that instance it is a refusal nobody can ever lift.
 */
const freshBaseUrl = inject("freshBaseUrl");

describe("/tasks", () => {
  it("shows the owner what this instance runs, and when it is due", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);

    const { status, text } = await documentFrom(baseUrl, "/tasks", cookie);

    expect(status).toBe(200);
    const tasks = sectionIn(text, "tasks");
    expect(tasks).toContain("Remove sessions that can no longer answer");
    // THE TRIGGER, IN WORDS. A task whose schedule the page did not state would
    // leave the owner unable to tell a job that is not due from one that has
    // stopped -- which is the distinction the whole record is about.
    expect(tasks).toContain("Every day at 03:00");

    // AND THE SECOND TASK, WHICH IS THE REGISTRY COMPACTING ITS OWN HISTORY
    // (CNCORE-124). ADR-0049 lists tombstone compaction among the eight things
    // its registry exists to run, and `task_runs` was itself a table that only
    // grew -- so this row is that record's category arriving back at its own
    // table, on its own trigger an hour behind the sweep.
    expect(tasks).toContain("Remove runs the history no longer shows");
    expect(tasks).toContain("Every day at 04:00");
  });

  it("says a task has never run rather than showing it as one that did nothing", async () => {
    // "NEVER RUN" AND "RAN AND FOUND NOTHING" ARE DIFFERENT SENTENCES, and only
    // one of them is health. This instance is built fresh for the suite, so the
    // first read of the page is the never-run case -- and it is the one that
    // would otherwise be rendered as a reassuring blank.
    const cookie = await logInAt(baseUrl, ownerPassword);

    const { text } = await documentFrom(baseUrl, "/tasks", cookie);

    expect(sectionIn(text, "tasks")).toContain("Has not run yet");
  });

  it("runs the tasks from the page, and the page then says what each did", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const { text } = await documentFrom(baseUrl, "/tasks", cookie);
    // EVERY FORM THE PAGE OFFERS, rather than the first of them. The negative
    // below is the point of this test -- a row that reports its run AND still
    // claims it has never run is the failure it catches -- and that assertion
    // reads the whole section, so it only ever meant "this task" while the
    // registry carried one task. CNCORE-124 made it two, and scoping it back to
    // the first form would have left the second task's never-run sentence
    // failing a test about the first. Running all of them keeps the assertion
    // exactly as strong as it was written to be, and keeps it true as ADR-0049's
    // remaining seven arrive.
    const [first, ...rest] = postFormsIn(sectionIn(text, "tasks"));
    if (!first) throw new Error("/tasks offered no form to run a task with");

    let after = await submit(baseUrl, "/tasks", first, cookie);
    for (const form of rest) after = await submit(baseUrl, "/tasks", form, cookie);

    expect(after.status).toBe(200);
    // THE REPORT IS THE RE-RENDERED LIST rather than the action's return value,
    // which is the rule `/import` and `/devices` both take: an action's answer
    // reaches a page only through `useActionState`, a client hook, so reporting
    // through it would make this surface's answer depend on JavaScript.
    const tasks = sectionIn(after.text, "tasks");
    expect(tasks).toContain("Removed");
    expect(tasks).not.toContain("Has not run yet");
  });

  it("shows the runs before the last one, so one outcome reads as a pattern", async () => {
    // ADR-0049 ASKS FOR A HISTORY AND NOT A LAST OUTCOME. A sweep that failed
    // last night reads the same as one that has failed every night for a
    // fortnight, and those are a glitch and a broken machine.
    const cookie = await logInAt(baseUrl, ownerPassword);
    const runOnce = async () => {
      const { text } = await documentFrom(baseUrl, "/tasks", cookie);
      const [form] = postFormsIn(sectionIn(text, "tasks"));
      if (!form) throw new Error("/tasks offered no form to run a task with");
      return submit(baseUrl, "/tasks", form, cookie);
    };

    await runOnce();
    const { text } = await runOnce();

    // THE RUNS BEFORE THE LAST ONE, folded away behind a `details` that needs
    // no JavaScript to open.
    //
    // MATCHED WITHOUT THE COUNT, because this instance is shared with every
    // other file in this suite and the sweep is the one task any of them can
    // run. Asserting "2 runs" would be asserting what the files before this one
    // happened to do.
    const tasks = sectionIn(text, "tasks");
    expect(tasks).toMatch(/runs? before it/);
    // AND THE HISTORY IS A LIST OF RUNS rather than a count in a label: at
    // least the earlier of the two this test made is rendered under it.
    expect(tasks.match(/Removed no sessions/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("runs the history compaction from the page, and reports what it removed", async () => {
    // ADR-0049's MINIMUM, APPLIED TO THE TABLE THAT MAKES IT REACHABLE. A
    // compaction whose result nobody can see is the maintenance job that
    // silently stopped months ago -- and it is the one task here whose stopping
    // would be invisible in the ordinary way, because what it leaves behind is
    // a table nobody looks at until it is large.
    const cookie = await logInAt(baseUrl, ownerPassword);
    const { text } = await documentFrom(baseUrl, "/tasks", cookie);
    // FOUND BY ITS KEY RATHER THAN BY ITS POSITION. The page renders the tasks
    // in the order `theTasks` was written in, so an index here is a test that
    // silently retargets the day a task is inserted above this one -- and goes
    // on passing, against the wrong task. Found in review.
    const compact = postFormsIn(sectionIn(text, "tasks")).find(({ fields }) =>
      fields.some(([name, value]) => name === "key" && value === "compact-task-runs"),
    );
    if (!compact) throw new Error("/tasks offered no form to run compact-task-runs with");

    const after = await submit(baseUrl, "/tasks", compact, cookie);

    expect(after.status).toBe(200);
    // WHAT IT DID, IN A SENTENCE. This instance is minutes old, so nothing in
    // it is a month past the window and "no runs" is the true answer -- which
    // is the report that says the job ran and found nothing, rather than a
    // blank that reads the same as never having run.
    expect(sectionIn(after.text, "tasks")).toContain("Removed no runs.");
  });

  it("marks the moment a run happened as a time", async () => {
    /*
     * A MOMENT IS `<time>` OR IT IS NOT A MOMENT (CNCORE-177). This page prints
     * one in the middle of a sentence -- "Ran 13 September 2026 at 10:00 UTC."
     * -- and it printed it as bare words: right for a reader looking at it, and
     * indistinguishable from any other string to anything reading the page by
     * its markup. `/devices` and `/settings` print the same moment off copies
     * of the same formatter and both mark it; this one had lost the element.
     *
     * THE RUN IS MADE HERE rather than relied on from the test above. This
     * instance is shared with every other file in the suite, so what has
     * already run is not this test's to assume -- and a task with no run prints
     * no moment at all, which would pass an assertion that only counted zero.
     */
    const cookie = await logInAt(baseUrl, ownerPassword);
    const { text } = await documentFrom(baseUrl, "/tasks", cookie);
    const [form] = postFormsIn(sectionIn(text, "tasks"));
    if (!form) throw new Error("/tasks offered no form to run a task with");

    const after = await submit(baseUrl, "/tasks", form, cookie);

    const moments = momentsIn(sectionIn(after.text, "tasks"));
    expect(moments.length).toBeGreaterThan(0);
    for (const { machine, printed } of moments) {
      // THE WORDS THE PAGE ALREADY SAID, still said: UTC and said so, which is
      // this page's own rule and the one thing a reader cannot convert without.
      expect(printed).toContain("UTC");
      // AND A VALUE A MACHINE CAN READ, which is the whole of what the element
      // buys -- an element carrying an unparseable one is the same failure
      // wearing the right tag.
      expect(Number.isNaN(Date.parse(machine)), `\`${machine}\` is not a moment`).toBe(false);
    }
  });

  it("tells a visitor where the door is, and nothing else", async () => {
    // ADR-0044's VISITOR. The catalogue is open because the demo shows them
    // everything in it; what maintenance this instance runs is not in the
    // catalogue, and a list of what a machine does at three in the morning
    // answered to anybody is a description of when nobody is watching.
    const { status, text } = await documentFrom(baseUrl, "/tasks");

    expect(status).toBe(200);
    expect(() => sectionIn(text, "tasks")).toThrow();
    expect(text).toContain("/login");
  });
});

describe("/tasks, on an instance nobody can log in to", () => {
  it("offers no login, and says which silence that is", async () => {
    // "This page asks you to be them first" is a step on an instance with a
    // password and an impossibility on one without: nobody can become the owner
    // there, so a reader told to be them first is being asked for something no
    // password on earth would buy. `/login` renders no form there, which is
    // where following the link landed them.
    const { status, text } = await documentFrom(freshBaseUrl, "/tasks");

    expect(status).toBe(200);
    // THE WHOLE DOCUMENT FOR THE NEGATIVE, which is a real assertion on this
    // instance: the header offers no login here either (CNCORE-139), so nothing
    // on this page may link one.
    expect(text).not.toContain('href="/login"');
    const main = mainOf(text);
    expect(main.toLowerCase()).toContain("no password set");
    /*
     * AND THE SENTENCE BEFORE IT STILL READS AS A SENTENCE. That half is a
     * PROP now (CNCORE-146): the three pages that are wholly the owner's render
     * one component and pass their own words into it. A prop is a string rather
     * than JSX text, so an `&apos;` carried across from the markup this
     * replaced is the way it would break -- silently, and only in the one word
     * a reader looks straight at.
     */
    expect(main).toContain("is its owner's business.");
  });
});

describe("/tasks, to a reader with no session on an instance that has a password", () => {
  it("still names the step that would make them the owner", async () => {
    // The answer the fix must not cost. This reader may BE the owner and simply
    // not have used the password yet, and the login is the step they can take.
    const { status, text } = await documentFrom(baseUrl, "/tasks");

    expect(status).toBe(200);
    // READ OFF THE PAGE, NOT THE DOCUMENT: the header offers this reader a
    // login on every page of this instance, so a document-wide check would pass
    // against a page that had gone silent inside a shell that had not.
    expect(mainOf(text)).toContain('href="/login"');
  });
});
