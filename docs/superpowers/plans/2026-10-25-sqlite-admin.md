# Courier SQLite admin and official store artwork

**Goal:** Keep download controls enabled with official store artwork and persist courier registrations for review at `/admin`.

**Execution constraints:** Implement immediately. The user's no-run instruction remains active: no install, server, app, build, or test execution. Asset downloads and source inspection are permitted file preparation. No existing database is created or modified during authoring.

**Architecture:** Keep React/Vite. Add a Node 24+ HTTP server using built-in SQLite and crypto, with Vite middleware in development and static `dist/` serving in production. No new npm dependency. Default public registration endpoint is `/api/couriers`. `/admin` is a dedicated, unprefixed authenticated page; locale-prefixed aliases also work.

## Requirements and decisions

- Official unmodified App Store and Google Play badge assets replace drawn Apple/Android symbols in download controls. A configured store URL opens its app page. Missing links keep an enabled button which explains that its link has not been added yet, without claiming a download started.
- SQLite is stored under `data/`, outside public/build assets, with parameterized queries. Registrations persist name, one phone number, city, device, locale, consent time, creation time, and review status. Duplicate phone submissions do not overwrite another applicant.
- Credentials come from private `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables, never `VITE_*`. No default password. Session cookies are HttpOnly and SameSite Strict, secure on HTTPS, backed by hashed tokens in SQLite with expiry. A random process binding invalidates sessions on restart, including credential changes; no password-derived verifier is stored. State-changing admin operations require origin and CSRF checks.
- Bound input sizes, server-side validation, persistent request limits, fixed pagination, and no public registration listing. The admin can search, filter, and update review status; no deletion/export requested.
- `npm run dev` runs the Node API and Vite on one origin. `npm run start` serves built files and the same API. Node must be 24+ for the selected built-in SQLite API. Existing dependency lock is preserved except its root engine metadata, if needed.

## Tasks

- [x] Prepare official badge assets and enabled fallback behavior.
- [x] Implement shared courier validation, SQLite storage, authentication, and HTTP routes.
- [x] Connect form to the local API; add bilingual admin login/list/filter/status UI.
- [x] Integrate development/production serving and document credentials, data persistence, and store links.
- [x] Review source paths, SQL bindings, authentication boundaries, failure states, and production hosting assumptions without running project code.

## Manual verification for the user

- Configure credentials, run development manually, submit a courier, refresh/restart, and verify the row persists in `/admin`.
- Confirm list/status APIs reject anonymous users, bad origins, missing CSRF, expired sessions, and incorrect credentials. Confirm logout removes access.
- Verify invalid/large submissions fail, duplicate phones do not overwrite data, Arabic/international phone normalization works, and status/search/pagination behave correctly.
- Verify official badges render in both themes, missing links remain enabled and explain availability, and configured links open correctly.
- Build and run production manually with an HTTPS public origin and persistent writable data directory; static-only hosting is insufficient for the SQLite API.

## Read-only review

- A separate reviewer found a password-derived SHA-256 session fingerprint persisted in the initial source. It was replaced with a random process binding, so no password-derived verifier is stored in SQLite. Sessions now require sign-in again after a restart; courier data remains persistent.
- The reviewer found no other important source defects in the reviewed authentication, SQL binding, mutation checks, and private-file serving. This was a source review, not runtime proof.
- Tests were authored for normalization, consent validation, persistence/reopen, duplicate handling, search binding, pagination, request-limit counters, authenticated reads, origin/CSRF protections, logout, expiry, restart/credential change invalidation, and API rate limits. None were run.
- No application, server, build, database initialization, or test execution occurred during this task. Official badge assets were downloaded unchanged from Apple/Google.

## Schema alignment — 2026-10-25

- User requested the existing landing schema. All eight base tables now mirror `../landing-page/db/schema.ts` in `db/schema.sql`, superseding the first custom `couriers`/`request_limits` schema.
- The active short form uses `courier_leads` with integer IDs, unique phone, nullable `ref`, resolved city strings, and SQLite timestamp defaults. Additional review/consent/legacy-ID metadata is isolated in `courier_lead_reviews`.
- `server/migrations.js` upgrades version 1 transactionally, preserves legacy applicants and limits, and leaves original registration rows untouched. Ephemeral admin sessions are reset into the reference three-column schema. Its `credential_hash` value remains a random process binding; HMAC-derived CSRF avoids extra columns.
- Admin numeric-ID updates, referral display, UTC timestamp parsing, validation, API aliasing, and tests were updated. The public canonical endpoint is `/api/courier-leads`; `/api/couriers` remains an alias.
- A separate read-only reviewer confirmed the eight base table definitions match, and found an index-name collision when replacing legacy sessions. The migration now explicitly recreates the expiry index after removing the legacy session table, with a fixture covering that case. Additional coverage handles older mandatory session columns and non-login limit migration.
- No database, migration, server, build, or test was executed. Runtime upgrade verification remains for the user on a backup, as documented in `docs/schema.md`.
