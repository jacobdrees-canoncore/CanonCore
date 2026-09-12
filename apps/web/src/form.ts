import type { z } from "zod";

/**
 * WHAT A FORM CARRIES, read as the text every field on it has to be.
 *
 * `FormData.get` ANSWERS `File | string | null`, AND ONLY ONE OF THOSE IS A
 * FIELD. A text input, a textarea, a select and a radio group all submit a part
 * with no `filename`, and `FormData.get` answers a string for one. A part that
 * CARRIES a filename is answered as a `File` instead, whatever the field was
 * called on the page that rendered it -- so a `z.string()` field handed one
 * throws a `ZodError`, and with no script loaded a Server Action that throws
 * renders a bare `Internal Server Error`. CNCORE-14 and ADR-0066 both say a
 * caller who asked for something impossible gets a refusal, and a 500 tells a
 * reader the server is broken when what happened is that they asked.
 *
 * A `File` AND A `null` ARE THE SAME ANSWER HERE, WHICH IS "NOT GIVEN". Neither
 * is text, and a surface that told them apart would be reporting on the shape of
 * the request rather than on what the owner asked for -- ADR-0066's own ground
 * for refusing to split one absence into two answers. Each schema below then
 * says what "not given" MEANS for its own field: `holds` carries a `.catch` and
 * reads it as "no container", and every other field has no reading for it and is
 * refused.
 *
 * IT NEVER SUBSTITUTES AN EMPTY STRING, and that is the one thing this must not
 * do rather than a detail. ADR-0096 makes an EMPTY note a REMOVAL -- there is one
 * control and clearing it is how the owner takes their note back -- so reading an
 * unusable field as `""` would delete the owner's words on a request they never
 * made. Nothing given is not the same claim as nothing said.
 *
 * THE SCHEMA NAMES THE FIELDS, rather than each caller listing them beside it.
 * A `z.object` already knows its own keys, so the twenty-three `form.get("...")`
 * calls this replaces -- thirteen call sites across five action files, counted
 * with `git grep -o` rather than by eye -- were twenty-three chances for a name
 * here to drift from the name on the page. The next action to be written
 * inherits the rule instead of repeating it, which is not hypothetical: three of
 * those thirteen arrived with CNCORE-72 while this change was in flight.
 */
export function whatTheFormCarries<Schema extends z.ZodObject>(
  form: FormData,
  schema: Schema,
): z.output<Schema> | undefined {
  const named = Object.fromEntries(
    Object.keys(schema.shape).map((name) => [name, asText(form.get(name))]),
  );

  /*
   * `safeParse` RATHER THAN `parse`, WHICH IS THE WHOLE REFUSAL. What a caller
   * composed by hand can be wrong in more ways than one -- a `File` where text
   * goes, a field left off entirely, or a value THIS schema refuses, such as
   * `takeRecord`'s `z.url()` or `namedPlacement`'s `z.uuid()` -- and every one of
   * them is the same fact about the request: it does not say what this action
   * needs to act on. The action stops, nothing is written, and the page it was
   * posted to renders again.
   *
   * WHAT THIS DOES NOT CLOSE, AND IT IS THE SAME 500: a value this schema
   * ACCEPTS and the ROUTER refuses. `editedTitle` declares `id: z.string()`
   * where `item.retitle` demands `z.uuid()`, so a hand-composed `id=not-a-uuid`
   * passes here and raises `BAD_REQUEST` inside `call()`. That half is CLOSED
   * now, and closed somewhere else: `whatTheProcedureAnswered` in `answer.ts`
   * reads an `ORPCError` under 500 as the answer it is, the way `/api/rpc`
   * already does one layer over (CNCORE-127). NOT by restating the router's
   * schema here -- this file's own docstring refuses that, because the rule
   * about what a write accepts lives in one place. The two readers are one
   * sentence each side of `call()`: a form field is input whoever rendered the
   * form, and a procedure's refusal is an answer whoever asked for it.
   *
   * THE COST, ACCEPTED RATHER THAN OVERLOOKED: a field RENAMED on a page and not
   * here now does nothing quietly where it used to answer 500 loudly. What
   * catches that is the page-over-HTTP suite, which submits the form the server
   * actually rendered and asserts the write happened -- so a name that drifts
   * fails a test rather than a reader.
   */
  const parsed = schema.safeParse(named);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Every value ONE REPEATED FIELD carries, each as the text it has to be.
 *
 * A LIST IS THE ONE SHAPE `whatTheFormCarries` ABOVE CANNOT READ, because it
 * asks the schema for its keys and reads ONE value per key. HTML expresses a
 * list as a repeated name and `FormData.getAll` keeps those in document order,
 * so two parallel names zip by index -- which no schema's keys can describe.
 *
 * IT IS THE SAME RULE, NOT A SECOND ONE. Each value goes through `asText`, so a
 * part with a filename is "not given" here exactly as it is there, and the
 * caller's schema says what "not given" means for its own field. Added by
 * CNCORE-73, whose reorder carries the siblings that shifted.
 */
export function whatTheFormRepeats(form: FormData, name: string): (string | undefined)[] {
  return form.getAll(name).map(asText);
}

/** One field, as the text it has to be -- or nothing, when it is not text. */
function asText(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}
