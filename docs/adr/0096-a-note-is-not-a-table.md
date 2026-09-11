---
status: proposed
---

# An owner note is a statement, never a table

Owner free-text about an item is a statement with a `note` property sourced to the Owner. Never
provider-assertable, never in a public payload.

ADR-0045 says the public read path carries "no notes", which
presupposes a concept nothing else defines. This defines it, and it does so without a table: a note
gets rank, language and provenance for free from
ADR-0012, and "never provider-assertable" becomes a property declaration
rather than a code path.
