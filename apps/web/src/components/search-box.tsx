import { Button } from "@canoncore/ui/components/button";
import { Input } from "@canoncore/ui/components/input";
import Form from "next/form";

/**
 * CATALOGUE SEARCH's way in, and it sits in the SHELL rather than on the front
 * page.
 *
 * "Finding something does not require knowing its id" is not a need a reader
 * stops having once they have opened an item, so the box is on every page the
 * layout wraps -- which is all of them.
 *
 * `Form` RATHER THAN `form`, WHICH IS ADR-0109'S RULE AND NOT A PREFERENCE. A
 * URL the framework does not rewrite is never hand-built: Next prefixes
 * `<Link>`, `<Form>` and `router.push()` and nothing else. A raw
 * `<form action="/search">` here would render identically today and point at
 * the wrong place the day this app is served from a path, which is the sweep
 * that record exists to avoid. It is also what gives submission client-side
 * navigation without a line of script.
 *
 * `q` IS THE NAME ON THE WIRE, and it is short because a reader sees it: the
 * address bar after a search reads `/search?q=rose`, and that URL is shareable
 * (ADR-0066 makes the query the route). `query` would say no more.
 *
 * NO JAVASCRIPT IS REQUIRED OF THE READER. `Form` degrades to a plain GET form,
 * so search works with scripting off -- and the whole page-over-HTTP suite is a
 * reader with scripting off, which is why it can assert this at all.
 *
 * TODO(CNCORE-181): IT SEARCHES THE WHOLE CATALOGUE WHEREVER IT IS SUBMITTED
 * FROM, a narrowed page included. `/search` answers within a Group since
 * CNCORE-180, but the Group is picked on the results page: a reader on
 * `/search?q=rose&group=<id>` who types a second query here loses the scope
 * and picks it again. The box sits in the shell, which reads no page's query,
 * so carrying the Group into it is the scope travelling between surfaces --
 * CNCORE-181's, as ADR-0010 records under CNCORE-179.
 */
export function SearchBox() {
  return (
    <Form action="/search" className="flex items-center gap-2">
      {/*
        A LABEL THAT IS READ RATHER THAN SEEN. The box is plainly a search box
        to somebody looking at it and is nothing at all to somebody who is not,
        so the name goes in the accessible tree where it is needed. `Search` is
        the visible path in its own right -- there is no accelerator here that
        this is the only route to (`CLAUDE.md`).
      */}
      <label htmlFor="catalogue-search" className="sr-only">
        Search the catalogue
      </label>
      <Input
        id="catalogue-search"
        name="q"
        type="search"
        placeholder="Search the catalogue"
        className="h-8 w-48 sm:w-64"
      />
      <Button type="submit" size="sm" variant="secondary">
        Search
      </Button>
    </Form>
  );
}
