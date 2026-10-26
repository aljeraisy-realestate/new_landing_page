# Giftly landing

A bilingual landing site with a Node/SQLite courier-registration service and a separate protected management dashboard, built from Giftly's mobile designs and workflow. Its URL prefix comes only from private runtime `ADMIN_PATH`. The original sibling projects are unchanged.

The site includes occasion selection, an interactive workflow, a screen gallery, a native full-screen image dialog, benefits, FAQs, an iOS/Android download section, and dedicated courier, privacy, terms, and about pages. Arabic is the default, with complete English support and a light/dark theme switch. The original screen images retain their supplied language.

“How it works” follows **Create request → Chat → Review invoice → Completed delivery**, with matching previews, direct step selection, and Previous/Next controls. The request, chat, and invoice previews also appear in the gallery and full-screen viewer.

The security section at `/ar#security` or `/en#security` explains Giftly's intermediary role: invoice review, amount held during preparation/delivery, then release to the courier after order completion. “Why Giftly” leads with that model, alongside communication, itemized invoices, and completion confirmation. The user supplied this product positioning; a short availability note remains because the backend currently marks production payments disabled. This is explanatory marketing content, not an implemented payment integration. The requested greeting links and heart-to-door tagline were removed in both languages.

## Run manually

Use **Node.js 24 or newer**. The backend uses Node's built-in `node:sqlite` and `node:crypto`, plus `jose` for JWT signing and verification. No separate database installation is needed. From this directory:

```powershell
npm ci
npm run dev
```

Development serves the React app and API together at `http://localhost:3000`. Port 3000 is fixed for development and production; no `PORT` variable is needed. Restart any previously running server after changing private settings.

If `.env` does not exist, copy `.env.example` to `.env`. Otherwise add missing settings without overwriting your store URLs. Set private `ADMIN_PATH` to one lowercase URL segment (3–64 letters/digits/underscores/hyphens, starting with a letter or digit), avoiding reserved public routes. The example is only a suggested value; your actual chosen prefix stays in ignored `.env`. Set `ADMIN_USERNAME` (3–100 characters), `ADMIN_PASSWORD` (4–512 characters), and `ADMIN_JWT_SECRET` (64 random hexadecimal characters / 32 bytes). Restart after changes and open the URL matching `ADMIN_PATH`; append `/login` for sign-in. There are no credential/key fallbacks in code. Never prefix private settings with `VITE_`.

Generate your own signing secret manually with Node, then paste its output into `ADMIN_JWT_SECRET` in your private `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the secret stable across restarts and out of source control. Changing credentials or the signing secret invalidates existing sessions after restart.

For a production build and local preview, `APP_ORIGIN` defaults to `http://localhost:3000` when empty. Run:

```powershell
npm run build
npm run start
```

The same npm commands work on macOS/Linux. `npm run preview` aliases the production Node server. For public deployment, set `APP_ORIGIN` to your exact HTTPS origin (for example `https://giftly.sa`) and use an HTTPS reverse proxy. The normal host binding defaults to `127.0.0.1`; Docker binds `0.0.0.0` inside the container. Port remains 3000.

## Docker

The multi-stage `Dockerfile` builds both page entries with Node 24 and runs production dependencies as the non-root `node` user. `.env` and local databases are excluded from the build context. Compose reads `.env` at runtime, publishes `3000:3000`, and mounts the persistent `giftly-data` volume at `/data` for SQLite. No port variable is required.

After starting Docker Desktop yourself, build and run manually:

```powershell
docker compose build
docker compose up -d
```

Open `http://localhost:3000/ar`; management is at the path stored in `ADMIN_PATH`. To stop the container use `docker compose down`; keep the named volume to preserve registrations. The volume starts separately from your existing local `data/` folder. To carry existing records over, stop the old service, back up its database, and restore the backup into the volume before starting the new service. Do not remove the volume unless you intend to discard its contents.

Only the public store URLs are passed as build arguments; update them and rebuild when needed. Credentials, JWT secret and the private route are supplied only at runtime. A health check verifies the public page on port 3000. See [Docker deployment details](docs/docker.md).

Dependency declarations use npm's `latest` tag. Keep `package-lock.json` for reproducibility. The JWT update adds [jose 6.2.13](https://www.npmjs.com/package/jose?activeTab=versions), the latest release reported when authored. Its dependency-free lock entry was added from published package metadata without installation; no integrity value was invented. Run `npm ci` manually to install the updated dependencies. No dependencies were installed by the agent. SQLite initializes on server startup; see the current verification status below.

Reference metadata inspected on 2026-10-25 reported [React 19.3.1](https://registry.npmjs.org/react/latest) and [Vite 8.3.5](https://www.npmjs.com/package/vite?activeTab=versions). Actual installed versions depend on when you install. Setup follows the [official Vite guide](https://vite.dev/guide/) and [React plugin](https://github.com/vitejs/vite-plugin-react).

## SQLite folder and the original landing

The original landing stores SQLite through Wrangler/Miniflare, using `SQLITE_DATA_DIR` for its persistence folder. This app accepts the same setting. Use `SQLITE_DATA_DIR=data` locally; Docker defaults to `/data` and reuses the original `giftly-data` persistent volume. Fresh folders create `couriers.sqlite`. A folder containing the original `v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite` layout is detected automatically by its application tables, without choosing Wrangler's metadata database or creating a second empty database.

To reuse the original local data, stop the original app, back up its entire persistence folder, then set this in the new app's private `.env` and remove any old `SQLITE_PATH` line:

```dotenv
SQLITE_DATA_DIR=../landing-page/.wrangler/state
```

Paths are relative to this project, or absolute. Only one app should own the database during this changeover. The eight original base tables and existing IDs/records stay intact; separate extension tables support reviews and rotating JWT refresh tokens. Old admin sessions are invalidated on first upgrade, so sign in again. Wrangler's migration history is retained. The Node runtime opens the SQLite file directly; it does not require Wrangler or a remote D1 service.

If several application databases exist in the folder, startup fails with instructions to select one using optional `SQLITE_PATH`. When both settings are present, that explicit file must be inside `SQLITE_DATA_DIR`. Unreadable or unrelated SQLite files fail startup rather than producing an empty dashboard. Existing installations using only `SQLITE_PATH` remain supported. No existing sibling database is automatically imported or modified by configuration changes alone. See [schema compatibility](docs/schema.md).

## Store links

Copy `.env.example` to `.env` and add published store URLs when available:

```dotenv
VITE_APP_STORE_URL=https://apps.apple.com/...
VITE_PLAY_STORE_URL=https://play.google.com/...
```

The ellipses above are examples, not real app links. Leave values empty until you have the actual links. Only HTTPS URLs on `apps.apple.com` and `play.google.com`, respectively, are accepted. Buttons stay enabled. With no link yet, clicking displays an inline “link will be added soon” message; once configured, the badge opens the actual app page. Header, mobile navigation, and supporting pages link to `/ar#get-giftly` or `/en#get-giftly`.

The download buttons use unmodified official App Store and Google Play badge artwork, including their official icons, stored locally in `public/brands/`. These replace the hand-drawn Apple/Android symbols. Source URLs are recorded in `public/brands/README.txt`; see [Apple's badge guidance](https://developer.apple.com/app-store/marketing/guidelines/) and [Google's brand resources](https://developer.android.com/distribute/marketing-tools/brand-guidelines).

Vite variables are public and are embedded during build. Restart development or rebuild after changes. Do not put secrets in them.

## Language, theme, and cookies

- Default on a first visit: Arabic RTL and light theme.
- The header switches Arabic/English and light/dark on every page.
- Preferences are saved in `giftly_language` and `giftly_theme` cookies for 365 days, scoped to `/`, with `SameSite=Lax` and `Secure` on HTTPS. No contact information is stored in cookies or local storage.
- Admin sign-in uses `giftly_admin_access` (a 15-minute JWT) and `giftly_admin_refresh` (a rotating refresh credential), both HttpOnly, SameSite Strict, scoped to `<ADMIN_PATH>/api`, and Secure when `APP_ORIGIN` is HTTPS. Refresh hashes and session revocation records live in SQLite; raw tokens are never persisted there or in browser storage. Access refreshes shortly before expiry and on tab wake or an expired authenticated request. The refresh deadline is **three days from sign-in**, even after rotation. Sessions survive restarts with the same credentials, signing key, and database. Logout revokes the family immediately; changing credentials/key and restarting invalidates access.
- The `/ar` or `/en` path prefix determines the language, taking precedence over cookies. Unprefixed visits use the saved cookie, then Arabic. Old language-query links are accepted for compatibility and immediately rewritten to locale paths, removing the `lang` parameter. Other query parameters and section anchors are retained.
- Share Arabic: `/ar`.
- Share English: `/en`.
- Language switching preserves the current page, section anchor, and other query parameters, and updates the preference cookie. Browser Back/Forward restores the language indicated by the path.
- `src/content.js` contains page text in both languages.
- `src/pages-content.js` contains the supporting pages and form translations.

## Dedicated pages and hosting

| Path | Page |
| --- | --- |
| `/ar` or `/en` | Landing and download section |
| `/ar/couriers` or `/en/couriers` | Courier application |
| `/ar/about` or `/en/about` | Who we are |
| `/ar/privacy` or `/en/privacy` | Privacy policy |
| `/ar/terms` or `/en/terms` | Terms and conditions |
| `<ADMIN_PATH>` | Private management entry; selects sign-in or courier dashboard |
| `<ADMIN_PATH>/login` | Dedicated management sign-in page |
| `<ADMIN_PATH>/couriers` | Dedicated authenticated courier dashboard |

The locale-prefixed `/become-courier`, `/who-we-are`, and `/rules` paths are public aliases. Unprefixed public routes use the chosen locale, so `/` becomes `/ar` on a first visit. Management uses its configured prefix and saved language. Old `/admin`, `/ar/admin`, `/en/admin` and external `/api/admin` routes return 404 without redirecting or revealing the configured prefix. The Node server is required for management routing; static-host fallback rules do not provide it.

**Run the Node server to use registration and admin.** Deploying only `dist/` to static hosting will not provide SQLite storage or the API. Use a host supporting Node 24+ and a persistent writable disk, with all requests sent to the same service. `public/_redirects` is retained for the frontend-only fallback but does not provide a backend.

## Courier application delivery

The form collects full name, one mobile number, city, and phone type. It validates Saudi numbers, including `+966`, `00966`, spaces, and Arabic/Persian numerals; city names and names support Arabic/English. Applicants explicitly agree to contact use before proceeding. Submitted details are stored in SQLite, not browser storage, and reviewed by authorized administrators.

The form sends JSON to the built-in same-origin `POST /api/courier-leads` endpoint, matching the original landing's endpoint name. `/api/couriers` remains an alias. No endpoint setting or email handoff is needed:

```json
{
  "name": "Applicant name",
  "phone": "0512345678",
  "city": "riyadh",
  "cityOther": "",
  "phoneType": "iphone",
  "ref": "",
  "locale": "ar",
  "consent": true
}
```

The server independently validates all fields, requires explicit consent and a matching browser origin, rejects bodies larger than 8 KB, applies request limits, and uses SQL parameter binding. Phone numbers normalize to `05` plus eight digits. A duplicate phone receives the same success response without changing the existing applicant, avoiding overwrite and registration disclosure. Errors/timeouts retain the form and show an error.

Registration uses the original landing's **`courier_leads`** schema: integer autoincrement IDs, `name`, unique `phone`, `city`, `phone_type`, optional `ref`, `locale`, and SQLite creation/update timestamps. The optional referral comes from the courier page's `ref` query parameter. Custom city names are saved directly in `city`, as in the original landing. The complete eight-table reference schema is mirrored in `db/schema.sql`; review/consent metadata lives separately in `courier_lead_reviews` so the base lead schema stays compatible. See [schema and upgrade details](docs/schema.md).

Local development defaults to `data/couriers.sqlite`. Docker uses `SQLITE_DATA_DIR=/data` and discovers the existing application database inside the original `giftly-data` volume. Compose and CranL set `SQLITE_REQUIRE_EXISTING=true` to prevent an empty replacement if the original database is missing. Optional `SQLITE_PATH` selects a specific file only when needed; do not place it under public/build assets. SQLite uses WAL mode; its database and companion files are ignored by Git and denied by development file serving. Back up using SQLite's backup tooling, or stop the service before copying its database files. Keep the data directory private and persistent across deployments.

An existing version 1 or 2 database is migrated to version 3 when you next start the server manually. The transaction preserves registrations, custom cities, review statuses, consent, and rate-limit windows, and leaves old registration rows retained in the legacy table. Pre-JWT admin sessions are cleared once; sign in again. The eight reference tables retain their layouts; `admin_refresh_tokens` is a separate extension referencing `admin_sessions`. No database or migration was executed during authoring; back up existing data before your manual restart. The sibling landing database is not automatically opened or changed.

## Admin

The management dashboard supports Arabic/English, both themes, password sign-in, automatic session renewal, registration counts, courier IDs, general search, dedicated city/mobile-number/device/status filters, and CSV import/export. Pagination starts at **20 records per page**, with **50** and **100** options and a visible record range. Sorting supports ID, name, mobile number, city, device, registration date and review status, in ascending or descending order. Every sort uses the ID as a stable tie-breaker. Changing filters, sorting or page size resets to page one; the server clamps pages that no longer exist. Previous/Next are disabled at the boundaries and while results are pending. Saved review statuses remain **New / Contacted / Accepted**. Listing and transfer require authentication; there is no deletion endpoint. Missing/invalid credentials or signing secret leave sign-in locked with setup instructions; an invalid/missing `ADMIN_PATH` prevents server startup.

Administration has its own internal HTML document (`admin/index.html`), React entry (`src/admin-main.jsx`), and responsive layout (`src/AdminApp.jsx`). Those filenames are not public page routes. It does not render public navigation, footer or marketing pages. The public app does not import management components/authentication code. Visiting the configured prefix inspects the current session and selects its `/login` or `/couriers` subpage. The header keeps language/theme controls at the outer edge for each reading direction.

The Vite build includes both documents, hashed asset names, no production source maps, and a private `.vite/manifest.json`. The server uses that manifest to deny direct public access to management-only assets and serves them under the configured prefix. Development also blocks direct management source aliases and routes their imports through the private prefix. The chosen route is derived from the visited URL in browser code and is never compiled into the build. Rebuild after this update: production requires the manifest. Runtime URL changes need a restart but no rebuild. Anyone who opens a page can inspect its delivered HTML/JavaScript; URL privacy complements JWT, CSRF and API authorization rather than replacing them.

Private routes:

| Method and path | Behavior |
| --- | --- |
| `POST <ADMIN_PATH>/api/session` | Sign in with `{ "username": "...", "password": "..." }` |
| `GET <ADMIN_PATH>/api/session` | Inspect access and refresh availability; returns CSRF/expiry metadata, never raw credentials |
| `POST <ADMIN_PATH>/api/refresh` | Rotate the refresh token and issue a fresh 15-minute access JWT; requires refresh cookie, same origin and CSRF |
| `DELETE <ADMIN_PATH>/api/session` | Sign out; requires session, same origin, and `X-CSRF-Token` |
| `GET <ADMIN_PATH>/api/couriers?search=&city=&phone=&phoneType=&status=&sortBy=created_at&sortDirection=desc&page=1&pageSize=20` | List applications after sign-in; return items, filtered total, clamped page, page size, total pages, previous/next availability and existing city options |
| `GET <ADMIN_PATH>/api/couriers/export` with the same filters and sorting | Return `{csv,count}` for every filtered match, across pages; maximum 10,000 records |
| `POST <ADMIN_PATH>/api/couriers/import` | Validate and atomically import `{csv,confirmed:true}`; requires CSRF and same origin |
| `PATCH <ADMIN_PATH>/api/couriers/:id` | Set a review status, for example `{ "status": "contacted" }`; requires CSRF and same origin |

Passwords are checked with scrypt and constant-time comparisons. A secret-keyed HMAC binds each session to current credentials without exposing a password verifier usable from the database alone. JWT verification restricts algorithm, issuer, audience, subject, token purpose and lifetime, and checks a live SQLite session to enforce revocation. Refresh tokens are random, hashed and single-use; consumed records are retained for replay detection until the session expires. Reuse within five seconds returns a conflict without issuing credentials, allowing concurrent tabs to recheck the shared cookies; later reuse revokes the entire session family. The browser uses Web Locks where available to coordinate rotation across tabs. Origin/CSRF checks protect mutations, including refresh and logout. Rate limits persist in SQLite; the server uses the connection address without trusting forwarded headers, so deployments behind a proxy share the per-IP limits unless that architecture is adapted. Limits per 15 minutes: registration 100 global/20 per address/5 per phone; sign-in 60 global/8 per address; refresh 120 per address.

### CSV transfer

The dashboard exports all matches for the **applied** search, city, mobile number, device and status, in the selected order, rather than just the visible page. Known city IDs and their Arabic/English labels are treated as aliases; custom cities also appear in the filter. Mobile-number filtering accepts partial local digits, full Saudi international numbers and Arabic/Persian digits. Narrow the filters if results exceed 10,000. CSV files use UTF-8 with a BOM, quoted cells and formula escaping; phone values receive a leading apostrophe to retain their zero in spreadsheet tools. The importer understands that prefix.

Use **Download import template** to get a blank file. Required headers: `name,phone,city,phone_type`. Optional headers: `id,ref,locale,status,consent_at,created_at,updated_at`. Imported IDs are ignored; SQLite assigns IDs. Device values are `iphone` (or `ios`) and `android`; locale defaults to `ar`, status to `new`. Cities accept known IDs or Arabic/English labels, plus valid custom city names. Dates accept UTC `YYYY-MM-DD HH:mm:ss` with optional three-digit milliseconds, or ISO UTC ending in `Z`; timestamp precision is preserved. Missing creation/update times use server defaults. Missing consent evidence stays null and is never invented.

Imports allow 1,000 rows / 2 MB of UTF-8 CSV per file. Larger exports must be split before import. A preview shows the first five valid applications, counts, duplicates within the file, and up to 50 row errors. All errors must be fixed before saving. The administrator must confirm authorization to use the supplied data. The server repeats validation, requires origin/CSRF, and saves the batch in one transaction. Existing normalized phone numbers are skipped without changing names, status or metadata; duplicates within a file keep the first valid occurrence. The result reports added/skipped counts. Limits per connection address per 15 minutes: 10 imports and 20 exports. No base table schema is changed.

## Page references

The homepage reference was inspected through indexed results from [giftly.sa](https://giftly.sa/). The live about, privacy, terms, and courier subpages could not be retrieved by the web tool, so their corresponding local source in `../landing-page/app/components/` supplied the reference content. `LegalPage.tsx` supplied the original privacy and terms foundation. The detailed bilingual copy now lives in `src/legal-content.js`: 16 privacy sections and 18 terms sections, each with separate readable paragraphs. Existing section anchors, including `#legal-0`, retain their original topics. The pages include a revision date and a scrollable desktop contents list, with an unrestricted wrapping list on mobile.

The expansion covers order specifications, chat approvals, invoices, held payments and release, delivery proof, cancellation, refunds, disputes, courier obligations, data collection and sharing, recipients/location, retention, rights, security, and actual cookie/session behavior. The 48-hour support target explicitly concerns an initial response; final dispute resolution depends on evidence and payment processing. Retention, hosting locations, fees, and bank turnaround periods are not given invented fixed values. Reference checks used the official [Saudi Personal Data Protection Law](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL) and [E-Commerce Law](https://misa.gov.sa/app/uploads/2025/07/E-Commerce-Law.pdf). `AboutPage.tsx`, `CourierLeadPage.tsx`, and `SiteChrome.tsx` supplied the brand story, contact/company details, courier form context, cities, and phone types. Payment wording retains the availability note because production payments are not enabled by this landing site.

## Source assets and product facts

All screen files below were copied verbatim from `../mobile/Giftly/Giftly/`:

| Local asset | Original design |
| --- | --- |
| `public/screens/home.png` | `Home Page Flow (user)/Home page.png` |
| `public/screens/calendar.png` | `Home Page Flow (user)/No appointments yet-3.png` |
| `public/screens/tracking.png` | `Order & Tracking Flow (user)/Order Tracking Stage 5.png` |
| `public/screens/delivered.png` | `Order & Tracking Flow (user)/Order Tracking Stage 7.png` |
| `public/screens/courier.png` | `Order & Tracking Flow (agent)/Home page.png` |

Artwork is copied from `../mobile/src/assets/images/hero.png` and `courier-gift.png`. Tajawal fonts and `OFL.txt` are copied from `../mobile/src/assets/fonts/`. The small brand mark follows `../mobile/src/components/GiftlyMark.tsx`; the favicon uses a simple gift motif. Palette values come from `../mobile/src/theme/theme.tsx`.

These are historical original app **design previews**, not screenshots captured from the current running application. That distinction appears in the page and screen viewer. The historical chat screenshot with unrelated placeholder content and historical invoice with outdated VAT copy are excluded.

The request/chat/invoice previews are **HTML/CSS illustrations based on the current mobile screen source**, not runtime screenshots. They are labeled as illustrative and show fictional sample details. `src/MobilePreview.jsx` follows `RequestScreen.tsx` (description, images, city/date), `ChatScreen.tsx` and its chat components (conversation and invoice context), and `CustomerInvoiceSummary.tsx` (line items, quantities, fees, total, no invented tax row). The invoice's sample total is 195 SAR: cake 120 + flowers 45 + delivery 20 + service 10. No preview creates orders, sends chat, or takes payments. The final completion preview continues to use the original `Order Tracking Stage 7.png` image.

Product copy is grounded in the mobile request/home/order/calendar screens, `../backend/docs/architecture.md`, `../backend/README.md`, the previous landing's components, and the user's description of Giftly's payment intermediary role. The separate mobile backend says production payments are disabled pending integration; the security section explains the hold-and-release model with an availability note. This site's new SQLite service stores courier applications only; it does not implement payments.

## Files

- `PROMPT.md`: reusable prompt for creating or evolving this landing page.
- `src/App.jsx`: layout and interactions.
- `src/content.js`: localized copy and screen manifest.
- `src/preferences.js`: cookie persistence, Arabic defaults, and language-aware links.
- `src/SitePages.jsx`: supporting pages and courier form.
- `src/pages-content.js`: bilingual supporting-page content and city list.
- `src/DownloadSection.jsx`: iOS and Android links and availability states.
- `src/MobilePreview.jsx`: localized illustrative request, chat, and invoice screens.
- `src/mobile-preview.css`: source-inspired mobile preview layout and sequential workflow controls.
- `src/SecuritySection.jsx` and `src/security.css`: the payment-intermediary explanation and responsive hold/release diagram.
- `src/styles.css`: identity, typography, responsive layout, and motion preferences.
- `src/pages.css`: supporting pages and complete dark-theme overrides.
- `admin/index.html`, `src/admin-main.jsx`, and `src/AdminApp.jsx`: standalone admin entry, preferences, and page routing.
- `src/AdminPage.jsx` and `src/admin.css`: private sign-in/dashboard content and admin layout.
- `src/AdminTransfer.jsx` and `shared/courier-csv.js`: bilingual transfer controls, CSV validation, template and serialization.
- `tests/admin-transfer.test.js` and `tests/courier-csv.test.js`: focused CSV/HTTP/SQLite transfer checks using temporary data.
- `src/ui.jsx`: branding and icons shared by the public and admin applications.
- `shared/page-routes.js`: separate HTML document selection and admin destinations.
- `tests/page-routes.test.js`: manual-run document-routing and admin destination checks.
- `shared/courier.js`: shared city list, phone normalization, and server validation.
- `server/index.js`: development middleware and production HTTP/static server.
- `server/api.js`: registration and authenticated admin endpoints.
- `server/store.js`: private SQLite schema, queries, sessions, and rate limits.
- `db/schema.sql`: SQLite tables matching `../landing-page/db/schema.ts`, plus separate review metadata.
- `server/migrations.js`: transactional alignment and preservation of earlier registrations.
- `docs/schema.md`: schema mapping, compatibility boundaries, upgrade and rollback instructions.
- `tests/couriers.test.js`: manual-run validation, SQLite persistence, and auth/CSRF regression tests.
- `docs/superpowers/plans/2026-10-25-giftly-landing.md`: implementation plan and manual verification checklist.

## Verification status

The initial implementation was authored without execution. The development server was subsequently started at the user's request; startup initializes or migrates the configured SQLite database. A browser check then reproduced a blank page caused by the server blocking Vite's optimized React modules under `node_modules/.vite/deps/`. The path guard now permits only those JavaScript/source-map assets during development, with Vite's filesystem restrictions still applied. Other dot directories, private server files, and database paths remain blocked.

The three focused tests in `tests/static-paths.test.js` passed, and the landing page and standalone admin page were verified rendering in the browser after restart. The later CSV update passed 15 focused parser/HTTP/SQLite checks and a production build of both entries; its export button and import controls were also checked in the browser. No dependencies were installed. The full suite remains unrun: automatic approval review rejected that broader run because of the earlier no-tests instruction. Run it only with explicit approval, then check remaining registration, session, locale/theme and download behavior before deployment.

The subsequent private-route/Docker update passed 10 focused route/client/cookie-scope checks, a local production build, a build-output privacy scan and `docker compose config --quiet`. Read-only review found and resolved an asset path-normalization bypass. Docker's Linux engine was unavailable, so no image was built or container verified. The development server remains stopped, as requested; no server/container was started for this update.
