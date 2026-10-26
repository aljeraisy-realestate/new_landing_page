# SQLite schema alignment

The base schema is defined in `../db/schema.sql`, mirroring `../../landing-page/db/schema.ts` and its SQLite migrations. No Drizzle dependency is needed by the Node runtime to use the same physical SQLite schema.

| Reference table | Purpose in this site |
| --- | --- |
| `courier_leads` | Active lightweight courier registration: integer autoincrement ID, name, unique phone, city, phone type, optional ref, locale, created/updated timestamps |
| `courier_applications` | Reference full application schema retained; this site's short form does not collect identity or email fields |
| `android_interest` | Reference schema retained; no new collection form or endpoint added |
| `contact_messages` | Reference schema retained; no new contact form or endpoint added |
| `admin_sessions` | Same three columns: token hash, credential hash, expiry |
| `admin_preferences` | Reference theme/language schema retained; this site's preference controls continue to use cookies |
| `admin_login_attempts` | Admin login request limits, using `reset_at` |
| `courier_submission_limits` | Registration request limits, using `reset_at` |

Base column names, types, default values, nullability, unique phone index, and reference indexes/checks follow the original schema. In particular, `courier_leads` has no added status, consent, or custom-city column. A custom city is stored directly in `city`, matching the original validator. SQLite default timestamps use UTC `CURRENT_TIMESTAMP`; the admin interprets them as UTC and displays Riyadh time.

`courier_lead_reviews` is a separate extension for this site's existing review statuses and consent evidence. Its `lead_id` references `courier_leads.id`, and optional `legacy_id` retains the previous UUID mapping. It does not change the reference lead table.

`admin_refresh_tokens` is another separate extension. It stores SHA-256 refresh-token hashes, a foreign key to `admin_sessions.token_hash`, the absolute expiry, and a nullable consumption time. The foreign key cascades on session removal; consumed records remain until expiry for replay detection. No original base columns are added or removed.

`admin_sessions.token_hash` hashes the random session-family ID; `credential_hash` contains a domain-separated HMAC keyed by private `ADMIN_JWT_SECRET` over current username/password. The secret is never stored in SQLite, so this is not a fast password verifier usable from the database alone. CSRF tokens are derived using HMAC from the session ID and binding. JWT access expires after 15 minutes; the session/refresh family expires three days from sign-in. Rotation retains that deadline. Logout revokes the family, and credential/key changes invalidate it on server restart. Sessions otherwise survive restarts. An imported old landing session is not treated as valid for this app.

## Upgrade from the first new-landing schema

Migration code lives in `../server/migrations.js`. Focused compatibility checks execute it only against temporary test databases.

When the Node server is next started manually, the migration runs transactionally and sets SQLite `user_version` to 3. For a version 1 database:

1. Creates the reference tables and indexes.
2. Copies `couriers` rows into `courier_leads`, assigning integer IDs and keeping existing phone matches untouched. Custom cities are resolved from the old `city_other` field; original dates are converted to SQLite UTC format.
3. Preserves review status, consent time, and the old UUID in `courier_lead_reviews`.
4. Copies rate-limit windows from `request_limits` into the matching reference tables.
5. Replaces incompatible ephemeral session tables, recreates the expiry index, and clears old sessions. Administrators sign in again.
6. Leaves old `couriers` and `request_limits` tables untouched as legacy data. They are no longer read or written by the app. Reopening version 2 or newer does not import them again.

Upgrading version 2 adds `admin_refresh_tokens` and clears pre-JWT sessions once. Existing courier rows and reviews remain intact. Reopening version 3 preserves valid JWT session families.

If the input already has the reference `courier_leads` table, existing IDs, referral values, records, and unrelated tables remain intact. Wrangler's `giftly_migrations` table is also retained. Focused tests initialize a temporary database using copies of the original landing's five Drizzle migrations and confirm its original table definitions and records survive opening and reopening in this app.

## Persistence folder

`SQLITE_DATA_DIR` is the same private runtime folder setting used by the original landing. It defaults to `data` locally and `/app/data` in Docker. Startup recursively inspects `.sqlite`, `.sqlite3`, and `.db` files read-only, recognizes application tables, and opens the sole matching application database. This supports the original Wrangler `v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite` layout as well as the existing flat `couriers.sqlite` layout. Metadata databases are not selected. Empty directories create `couriers.sqlite`; unrelated, unreadable or ambiguous databases cause startup to fail instead of silently replacing data. Symlinks within the persistence directory are rejected.

Optional legacy `SQLITE_PATH` chooses a specific database file; when both variables are set, it must be inside the configured directory. Existing file-only configurations remain supported. To reuse the sibling's data, stop its service, back up the complete persistence directory, remove the old file override and set `SQLITE_DATA_DIR=../landing-page/.wrangler/state`. Then start only the new service. This is a changeover, not a promise of concurrent compatibility between the two servers' authentication and migration behavior. No sibling data is changed until an operator starts this app against that folder.

Before upgrading an existing live database, stop the service and take a backup of its SQLite files. Keep the backup outside public/build directories. To roll back, restore that backup with the previous code; do not manually reduce `user_version` or rely on the retained legacy tables to recreate later edits.

## Endpoint and form compatibility

The short form posts to `/api/courier-leads`; `/api/couriers` remains an alias. It sends `name`, `phone`, `city`, optional `cityOther`, `phoneType`, optional `ref`, `locale`, and explicit `consent`. The optional referral code comes from the courier page's `ref` query parameter and is shown in the admin table. Unlike the old form's implicit consent wording, this site requires `consent: true` at its endpoint.

Base schema compatibility does not mean runtime compatibility with the old Cloudflare D1/Drizzle server. This site continues using its Node/SQLite server and its own protected admin endpoints.
