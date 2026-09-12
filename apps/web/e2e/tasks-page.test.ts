import { describe, expect, inject, it } from "vitest";

import { documentFrom, logInAt, postFormsIn, sectionIn, submit } from "./document";

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

  it("runs a task from the page, and the page then says what it did", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const { text } = await documentFrom(baseUrl, "/tasks", cookie);
    const [run] = postFormsIn(sectionIn(text, "tasks"));
    if (!run) throw new Error("/tasks offered no form to run a task with");

    const after = await submit(baseUrl, "/tasks", run, cookie);

    expect(after.status).toBe(200);
    // THE REPORT IS THE RE-RENDERED LIST rather than the action's return value,
    // which is the rule `/import` and `/devices` both take: an action's answer
    // reaches a page only through `useActionState`, a client hook, so reporting
    // through it would make this surface's answer depend on JavaScript.
    const tasks = sectionIn(after.text, "tasks");
    expect(tasks).toContain("Removed");
    expect(tasks).not.toContain("Has not run yet");
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
