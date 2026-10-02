# Outside code is used freely, but ships only under a licence the AGPL can carry

The Owner may use any outside code he has permission for, but before code with no licence, or with a restriction such as the Commons Clause, ships in the public repo, its author is asked to add a licence the AGPL can carry to the source; until then it may sit only in throwaway work that is not published, such as the design prototype. This is because the AGPL-3.0 (ADR 0018) passes every recipient a right to copy, change and host the code: a permission given to the Owner alone is not one he can pass on, and AGPL section 10 forbids shipping under "further restrictions". One exception is recorded: Arc Pro files ship under their own licence, with an additional permission under AGPL section 7 (ADRs 0018 and 0023).

## Considered Options

- Compatible licences only: rejected as stricter than needed, since a licence request costs one message.
- The Owner's permission is enough: rejected, because the grant covers him, not the people the AGPL hands the code to, and removing copied code from a shipped product later costs far more than asking now. This still holds for a permission given in conversation; Arc Pro differs because its written licence allows its use in an open-source end product, and CanonCore grants the section 7 permission itself (ADR 0023).

## Consequences

- MIT, Apache-2.0, BSD, ISC and GPLv3-family code needs nothing: the FSF lists Expat as "compatible with the GNU GPL" and Apache-2.0 as "compatible with version 3 of the GNU GPL" (gnu.org/licenses/license-list, read 2026-09-30).
- Apple's older sample-code licence (SPDX `AML`, used by Destination Video, Wishlist and Landmarks) is accepted like MIT, with Apple's notice kept on every copied file: Fedora rules it "free and GPL compatible", although the FSF has not listed it (decided 2026-09-30). Apple's photographs, videos and artwork in the samples are not code and never ship.
- The frosted-folder portfolio (fayazara/portfolio-site-template): its author gave permission verbally. Its README says MIT, but it carries no LICENSE file or copyright line; the author agreed on 2026-09-30 to add one, and its code ships once that file is in the repo.
