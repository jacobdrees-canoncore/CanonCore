import { Client } from "pg";

import "../load-env";
import { migrateToHead } from "../migrate";

/**
 * Builds a database FROM EMPTY and runs the whole ladder against it.
 *
 * Deliberately the same path CI's empty-to-head gate takes (ADR-0047), so the
 * gate and the suites cannot disagree about whether the ladder composes.
 *
 * KNOW WHAT EMPTY-TO-HEAD DOES NOT PROVE. Against an empty database Drizzle
 * applies every rung regardless of the high-water mark it uses on a populated
 * one, so this path goes green on a spliced migration that a real upgrade would
 * silently skip. `scripts/check-ladder.ts` covers that; this covers whether the
 * SQL is valid at all.
 */
export async function buildTestDatabase(suffix = ""): Promise<string> {
  const url = new URL(requireDatabaseUrl());
  const name = testDatabaseName(url, suffix);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    // FORCE so a leftover connection from a killed run cannot wedge the suite.
    await client.query(`drop database if exists ${quote(name)} with (force)`);
    await client.query(`create database ${quote(name)}`);
  } finally {
    await client.end();
  }

  const built = new URL(url);
  built.pathname = `/${name}`;
  await migrateToHead(built.toString());
  return built.toString();
}

/**
 * `<database>_test`, or `<database>_test_<suffix>`.
 *
 * REFUSES rather than truncates, and that is the whole point of it. PostgreSQL
 * silently cuts an identifier at 63 bytes, so a database named at 58 characters
 * or more would have its `_test` suffix cut back off -- and the next line of
 * this file is `drop database ... with (force)`. Truncation here destroys the
 * developer's real catalogue, silently, on a test run.
 *
 * The pathname is percent-DECODED first, because a URL carries it encoded and
 * `%20` is not the database's name.
 */
/**
 * How a test database is named from the worktree's own database. THE one place
 * that knows, so `worktreeDatabaseName`'s reservation and this cannot drift --
 * a second app calling `buildTestDatabase("something-longer")` would otherwise
 * silently eat the room reserved for it.
 */
export function testDatabaseNameFor(database: string, suffix = ""): string {
  return `${database}_test${suffix ? `_${suffix}` : ""}`;
}

function testDatabaseName(url: URL, suffix: string): string {
  const database = decodeURIComponent(url.pathname.slice(1));
  const name = testDatabaseNameFor(database, suffix);
  if (Buffer.byteLength(name, "utf8") > 63) {
    throw new Error(
      `the test database would be named "${name}", which PostgreSQL truncates at 63 bytes -- ` +
        `back onto "${database}" itself, which this file then drops. ` +
        `Point DATABASE_URL at a database with a shorter name.`,
    );
  }
  if (name === database) {
    throw new Error(`refusing to use the target database "${database}" as its own test database`);
  }
  return name;
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. These suites need a real PostgreSQL server: " +
        "`pnpm db:start`, or point DATABASE_URL at one you already run.",
    );
  }
  return url;
}

/** Database names are identifiers, not parameters, so they cannot be bound. */
function quote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
