import { describe, expect, it } from "vitest";

import { manifest, record } from "./cmpp";
import {
  ISSUED_BY_ITS_UPSTREAM,
  LOCKED_CREDENTIAL_FIELDS,
  LOCKED_UNLOCK_PATH,
  lockedProvider,
} from "./participants";

/** A complete submission to a witness's unlock path, every declared field set to `value`. */
function unlockWith(baseUrl: string, value: string) {
  return fetch(`${baseUrl}${LOCKED_UNLOCK_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      Object.fromEntries(LOCKED_CREDENTIAL_FIELDS.map((field) => [field.name, value])),
    ),
  });
}

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

/**
 * THE SPENDING WITNESS'S OWN HONESTY, and the two claims `contract.test.ts` cannot
 * make about it for the same structural reason it cannot make the one above.
 *
 * THAT IT SPENDS RATHER THAN REFUSING EVERYTHING. The contract suite holds no value
 * any upstream accepts, so to it the two are identical -- and a witness refusing
 * everything would keep the refusal branch green while standing for a provider
 * nobody could ever Unlock.
 *
 * THAT A REFUSAL LEAVES A HELD CREDENTIAL WHERE IT WAS. The suite runs its round
 * trip from `absent` and will not touch a held one, so this is the only place the
 * half with a security property on it is asserted: nothing authenticates an unlock
 * path, and a refusal that wrote anything would let anyone who can reach it lapse
 * the Owner's working session with a value they made up.
 */
describe("the witness that Spends", () => {
  it("holds the session its upstream issued, and then answers", async () => {
    const witness = await lockedProvider({ spends: true });
    try {
      const supplied = await unlockWith(witness.baseUrl, ISSUED_BY_ITS_UPSTREAM);
      expect(supplied.status).toBeLessThan(400);

      const after = manifest.parse(await (await fetch(`${witness.baseUrl}/`)).json()).credential;
      expect(after?.state).toBe("valid");

      const answered = await fetch(`${witness.baseUrl}/lookup/${witness.aRecord}`);
      expect(answered.status).toBe(200);
    } finally {
      await witness.close();
    }
  });

  it("refuses what its upstream did not issue, and leaves the one it holds exactly where it was", async () => {
    const witness = await lockedProvider({ spends: true });
    try {
      await unlockWith(witness.baseUrl, ISSUED_BY_ITS_UPSTREAM);
      const held = manifest.parse(await (await fetch(`${witness.baseUrl}/`)).json()).credential;

      const refused = await unlockWith(witness.baseUrl, "a value its upstream never issued");
      expect(refused.status).toBe(400);

      const after = manifest.parse(await (await fetch(`${witness.baseUrl}/`)).json()).credential;
      expect(after?.state).toBe("valid");
      expect(after?.state_changed_at).toBe(held?.state_changed_at);
      // AND IT STILL ANSWERS, which is what "exactly where it was" means to the
      // Owner: the session they had is the session they have.
      expect((await fetch(`${witness.baseUrl}/lookup/${witness.aRecord}`)).status).toBe(200);
    } finally {
      await witness.close();
    }
  });
});
