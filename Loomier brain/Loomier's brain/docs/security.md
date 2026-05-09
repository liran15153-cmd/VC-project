# Security

Security matters early because AI-generated projects, uploaded assets, and user-owned games create real risk.

---

## Hard Rules

Never:

- expose service keys in frontend code
- commit `.env`
- trust AI output
- trust frontend ownership claims
- allow unsafe upload filenames
- bypass Supabase RLS for convenience

Always:

- validate input with schemas
- sanitize generated/exported HTML
- enforce ownership
- keep service-role operations backend-only
- use signed URLs for private assets

---

## Supabase

Supabase should own:

- auth
- profiles
- games
- prompt history
- token ledger
- analytics events
- storage buckets

RLS must be reviewed before production. Do not assume "migration exists" means security is done.

---

## AI Output

AI-generated content is untrusted input.

Validate:

- game definitions
- asset references
- generated metadata
- generated HTML/export content
- patch/edit operations

Reject or retry invalid output.

---

## Uploads

When uploads are implemented:

- normalize filenames
- restrict extensions and MIME types
- scan/validate dimensions
- store under user-scoped paths
- keep license/source metadata

---

## Current Risk

The biggest current risk is architectural confusion, not attackers:

- too many prototypes
- multiple schemas
- multiple frontend ideas
- old HTML output vs new runtime definitions

Security improves when the system has one clear data path.

---

## Related

- [[HOME]]
- [[ARCHITECTURE_UPDATED]]
- [[docs/adr/ADR-001-supabase]]
- [[CLAUDE]]
- [[knowledge/open-questions]]
