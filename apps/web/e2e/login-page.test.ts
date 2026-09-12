import { describe, expect, inject, it } from "vitest";

import {
  carrying,
  documentAt,
  documentFrom,
  logInAt,
  postFormsIn,
  sectionIn,
  submit,
} from "./document";

/**
 * THE DOOR IN FRONT OF EVERYTHING THAT WRITES (CNCORE-109), over real HTTP.
 *
 * ADR-0044 decides the shape this asserts: one owner, one password, no signup --
 * and a public demo that is read-only WITH NO LOGIN. Both halves are here,
 * because they are the same mechanism seen from two instances: the seeded one
 * sets `OWNER_PASSWORD` and the fresh one does not.
 *
 * THE PAGE-OVER-HTTP SEAM AND NO BROWSER, as every other surface in this suite:
 * the form posts with no script loaded, which is what lets an owner log in to a
 * catalogue they are reading through anything at all.
 */
const baseUrl = inject("baseUrl");
const freshBaseUrl = inject("freshBaseUrl");
const ownerPassword = inject("ownerPassword");

/** The search box's own query, which any reader may run. */
const searching = "/import?q=Tenth";

describe("/login", () => {
  it("offers a password field, and asks for nothing else", async () => {
    const { status, text } = await documentAt("/login");

    expect(status).toBe(200);
    const [form] = postFormsIn(text);
    expect(form).toBeDefined();
    // ONE FIELD OF OUR OWN. The others Next writes for itself ($ACTION_ID), and
    // a second field of ours would mean this instance had learned to ask for a
    // username -- which ADR-0044 says it never does.
    expect(
      form?.fields.map(([name]) => name).filter((name) => !name.startsWith("$")),
    ).toStrictEqual(["password"]);
  });

  it("says a wrong password was refused, rather than failing silently", async () => {
    const { text } = await documentAt("/login");
    const [form] = postFormsIn(text);
    if (!form) throw new Error("/login rendered no form");

    const refused = await submit(baseUrl, "/login", carrying(form, "not the owner's password"));

    // THE OWNER IS TOLD. With no script loaded an action's return value goes
    // nowhere, so a refusal that did not reach the URL would leave a page
    // identical to the one that was never submitted.
    expect(refused.text).toContain("That password was refused");
  });

  it("tells the owner to wait when too many passwords have been tried", async () => {
    // A DIFFERENT SENTENCE FOR A DIFFERENT REFUSAL (ADR-0125). "That password
    // was refused" is a fact about the password; this one is a fact about how
    // often this instance has been asked, and an owner who has just typed theirs
    // correctly would be told a lie by the first.
    //
    // THE PAGE IS ASKED DIRECTLY RATHER THAN THE BOUND BEING DRIVEN OVER HTTP.
    // The allowance belongs to the server, and these files run in parallel
    // against ONE of them: a test that spent it here would refuse the logins
    // every other file in this suite makes.
    const { status, text } = await documentAt("/login?refused=too-many");

    expect(status).toBe(200);
    expect(text).toContain("Too many passwords have been tried");
    expect(text).not.toContain("That password was refused");
  });

  it("logs the owner in, and says so on the way back", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);

    const { text } = await documentFrom(baseUrl, "/login", cookie);

    expect(text).toContain("You are logged in");
    // AND THE FORM IS GONE, which is how this page says which state it is in.
    expect(
      postFormsIn(text).some(({ fields }) => fields.some(([name]) => name === "password")),
    ).toBe(false);
  });

  it("ends the session it started, so the token stops working", async () => {
    const cookie = await logInAt(baseUrl, ownerPassword);
    const loggedIn = await documentFrom(baseUrl, "/login", cookie);
    const [form] = postFormsIn(loggedIn.text);
    if (!form) throw new Error("a logged-in /login rendered no form to log out with");

    await submit(baseUrl, "/login", form, cookie);

    // THE SAME COOKIE, PRESENTED AGAIN, which is what a browser that kept it
    // does -- and what anybody who copied it would do. The row is ended, so it
    // opens nothing (ADR-0043's per-device logout).
    const after = await documentFrom(baseUrl, "/login", cookie);
    expect(after.text).not.toContain("You are logged in");
  });
});

describe("/import, to a reader who is not the owner", () => {
  it("shows the results and offers no button to import one", async () => {
    const { status, text } = await documentAt(searching);

    expect(status).toBe(200);
    // THE READ PATH IS OPEN (ADR-0044, ADR-0072): the demo shows a visitor
    // everything on the instance, so the search still ran and still answered.
    const results = sectionIn(text, "results");
    expect(results).toContain("Tenth");
    // AND THE OPERATION IS NOT OFFERED, rather than offered and refused. With no
    // script loaded a Server Action that throws renders a bare `Internal Server
    // Error`, so a button here would cost the reader the page they were reading.
    expect(results).toContain("Log in");
    expect(postFormsIn(results)).toStrictEqual([]);
  });

  it("offers the owner the button on the same page", async () => {
    const owner = await logInAt(baseUrl, ownerPassword);

    const { text } = await documentAt(searching, owner);

    // THE SAME ADDRESS, THE SAME RESULTS, and this time something to press. Both
    // halves matter: a page that offered nobody a button would satisfy the test
    // above and be broken.
    expect(postFormsIn(sectionIn(text, "results")).length).toBeGreaterThan(0);
  });
});

describe("/login on an instance with no password, which is the demo", () => {
  /**
   * ADR-0044's public demo is read-only WITH NO LOGIN, and this is how that is
   * built: `OWNER_PASSWORD` unset. Not a mode, not a deployment flag -- a
   * variable nobody wrote.
   */
  it("says nobody can log in, rather than offering a form that cannot succeed", async () => {
    const { status, text } = await documentFrom(freshBaseUrl, "/login");

    expect(status).toBe(200);
    expect(text).toContain("no password set");
    expect(postFormsIn(text)).toStrictEqual([]);
  });
});
