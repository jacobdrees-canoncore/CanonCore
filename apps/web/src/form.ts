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
 * A `z.object` already knows its own keys, so the nine `form.get("...")` calls
 * this replaces were nine chances for a name here to drift from the name on the
 * page -- and the next action to be written inherits the rule instead of
 * repeating it.
 */
export function given<Schema extends z.ZodObject>(
  form: FormData,
  schema: Schema,
): z.output<Schema> | undefined {
  const named = Object.fromEntries(
    Object.keys(schema.shape).map((name) => [name, asText(form.get(name))]),
  );

  /*
   * `safeParse` RATHER THAN `parse`, WHICH IS THE WHOLE REFUSAL. What a caller
   * composed by hand can be wrong in more ways than one -- a `File` where text
   * goes, a field left off entirely, a `baseUrl` that is not a URL, an id that
   * is not a uuid -- and every one of them is the same fact about the request:
   * it does not say what this action needs to act on. The action stops, nothing
   * is written, and the page it was posted to renders again.
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

/** One field, as the text it has to be -- or nothing, when it is not text. */
function asText(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}
