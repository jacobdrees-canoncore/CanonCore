import type { Page } from "playwright";
import { inject } from "vitest";

/**
 * ADR-0044's one password, exchanged for a session the way an owner does it.
 *
 * ONE FUNCTION FOR EVERY FILE HERE (CNCORE-226), for the reason `gate.ts` is
 * one: `reorder.test.ts` held it alone until `prose-width.test.ts` needed the
 * Owner's `/devices`, and two copies of the way in are where two files quietly
 * stop agreeing about which button logs in.
 */
export async function logIn(page: Page, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Password").fill(inject("browserOwnerPassword"));
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
