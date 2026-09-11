"use client";
import Link from "next/link";

import { OUR_MARK_PX } from "./marks";
import { ModeToggle } from "./mode-toggle";

export default function Header() {
  const links = [{ to: "/", label: "Home" }] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex items-baseline gap-4 text-lg">
          {/*
            CANONCORE'S OWN WORDMARK, and it is here to be a mark rather than a
            decoration. TMDB's terms require their logo be "less prominent than
            the logos or marks that primarily describe or identify Your
            Application" -- and until this line there was no such mark anywhere in
            the app, so the comparison had nothing to be less prominent THAN.

            The size is an inline style from `marks.ts` rather than a utility
            class, so the relationship it is half of is in the served HTML where a
            test can read it back. See that file for the other half.
          */}
          <Link href="/" className="font-semibold" style={{ fontSize: `${OUR_MARK_PX}px` }}>
            CanonCore
          </Link>
          {links.map(({ to, label }) => {
            return (
              <Link key={to} href={to}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
      <hr />
    </div>
  );
}
