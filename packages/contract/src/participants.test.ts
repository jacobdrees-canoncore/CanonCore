import { describe, expect, it } from "vitest";

import { manifest, record } from "./cmpp";
import { LOCKED_CREDENTIAL_FIELDS, LOCKED_UNLOCK_PATH, lockedProvider } from "./participants";

/**
 * THE LOCKED WITNESS'S OWN HONESTY, checked here because `contract.test.ts`
 * STRUCTURALLY CANNOT CHECK IT.
 *
 * That file holds every participant to one table and may not branch on which
 * provider it is talking to, so it cannot single this one out. And it cannot ask
 * ANY participant to answer after the credential round trip, because the only
 * credential it holds is a dummy: sent to a real upstream it would be refused,
 * lapsing the very session the round trip had just reported `valid`. That is the
 * whole reason `search` and `lookup` run BEFORE the credential block there.
 *
 * SO THE ONE CLAIM THAT WOULD OTHERWISE GO UNASSERTED IS ASSERTED HERE: that
 * Unlocking this witness changes what it answers. Without it the witness could
 * refuse for ever, every `search` and `lookup` assertion against it would take
 * CNCORE-141's refusal branch, and the suite would be green about a participant
 * that answers the same whether or not it holds a credential -- which is exactly
 * the shape that makes the new branch prove nothing.
 *
 * IT IS A TEST OF THE FIXTURE, NOT OF THE CONTRACT, and that is why it is not in
 * the contract file. Nothing here reaches a real provider.
 */
describe("the locked witness", () => {
  it("refuses before it is Unlocked and answers after, so the round trip means something", async () => {
    const witness = await lockedProvider();
    const ask = (path: string) => fetch(`${witness.baseUrl}${path}`);
    const lookup = `/lookup/${witness.aRecord}`;

    try {
      const before = manifest.parse(await (await ask("/")).json()).credential;
      expect(before?.state).toBe("absent");
      expect(before?.state_changed_at).toBeNull();

      // NOT BROKEN AND NOT EMPTY: a refusal that says so, rather than a record.
      const refused = await ask(lookup);
      expect(refused.status).toBe(503);
      expect(refused.headers.get("content-type")).toContain("application/json");

      const supplied = await fetch(`${witness.baseUrl}${LOCKED_UNLOCK_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(
            LOCKED_CREDENTIAL_FIELDS.map((field) => [field.name, "a value for the witness"]),
          ),
        ),
      });
      expect(supplied.status).toBeLessThan(400);

      const after = manifest.parse(await (await ask("/")).json()).credential;
      expect(after?.state).toBe("valid");
      expect(after?.state_changed_at).not.toBeNull();

      // AND NOW IT ANSWERS. This is the assertion the contract suite cannot make
      // against anybody: the same request, the same provider, a different answer
      // because it was given what it declared it needed.
      const answered = await ask(lookup);
      expect(answered.status).toBe(200);
      expect(record.parse(await answered.json()).id).toBe(witness.aRecord);
    } finally {
      await witness.close();
    }
  });

  it("bounds an unlock submission rather than accumulating it", async () => {
    const witness = await lockedProvider();
    try {
      // Nothing authenticates this route, by design (ADR-0122), so the ceiling is
      // what stands between an open route and an unbounded allocation.
      const refused = await fetch(`${witness.baseUrl}${LOCKED_UNLOCK_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session: "x".repeat(32 * 1024) }),
      });

      expect(refused.status).toBe(413);
      // AND IT STAYS LOCKED. A body refused for its size must not be half-read
      // into the credential it was too large to be.
      const still = manifest.parse(await (await fetch(`${witness.baseUrl}/`)).json()).credential;
      expect(still?.state).toBe("absent");
    } finally {
      await witness.close();
    }
  });
});
