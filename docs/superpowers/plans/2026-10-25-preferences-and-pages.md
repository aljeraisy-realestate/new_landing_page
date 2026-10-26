# Giftly preferences and supporting pages

**Goal:** Arabic by default; cookie-backed language and theme preferences; courier application; privacy, terms/rules, and about pages; explicit iOS/Android download section.

**Execution:** Implement immediately without approval, continuing the user's code-only/no-run instruction. No installs, servers, previews, builds, tests, or deployments. Preserve the existing installation and dependency lockfile.

**Architecture:** Retain React/Vite and use ordinary page links with pathname-based rendering, shared header/footer, and host history fallback. No new dependency is needed. Supporting pages, copy, downloads, preferences, and styles have separate files.

## Sources and decisions

- Indexed `https://giftly.sa/` establishes the public page references and identity. Direct live subpage requests failed; the corresponding existing landing's `LegalPage.tsx`, `AboutPage.tsx`, `CourierLeadPage.tsx`, `SiteChrome.tsx`, and courier helpers supply reference content. This limitation is documented rather than claiming live verification.
- The existing five Arabic privacy and five terms paragraphs are retained, with English translations. Cookie/form explanations describe the actual new behavior. Payment terms include an availability note because the backend still reports disabled production payments.
- Language precedence: valid query, valid cookie, Arabic. Theme precedence: valid cookie, light. Cookies last 365 days and contain only allowed language/theme values.
- Courier contact fields include separate mobile and WhatsApp numbers plus a same-number option; device type is also included to match the old site's form context.
- No receiving service was provided for this standalone site. The form prepares an honest email draft by default and supports a configured POST service. The original strict courier-lead endpoint cannot accept a separate WhatsApp field unchanged, so no incompatible integration is advertised.
- App-store URLs are not invented. Both platform cards are always present and show an enquiry until configured.

## Implementation record

- [x] Inspect current source and giftly.sa reference; record live-subpage retrieval limits.
- [x] Add `preferences.js`, Arabic initial HTML, and shared theme/language switches.
- [x] Add `SitePages.jsx` and `pages-content.js`, route handling, page navigation, form validation, email fallback, and configurable submission.
- [x] Add `DownloadSection.jsx`, platform cards, and homepage anchors from supporting pages.
- [x] Add `pages.css` for supporting pages, responsive layouts, and dark theme across the site.
- [x] Add `_redirects`, document endpoint contract and hosting requirements, update reusable prompt.
- [x] Review source imports, links, preference validation, form handling, and dark-theme selectors by reading files.

## Manual checks deferred to the user

- Fresh cookies show Arabic/light. English/dark survive refresh and navigation; invalid cookies are ignored and blocked cookies do not break controls.
- Open each route directly; verify the host fallback, both languages, and unknown-page handling.
- Check layouts at 320px/390px/desktop, text zoom, keyboard navigation, contrast in both themes, and the screenshot dialog.
- Check empty form, international/Arabic numeral phone inputs, separate WhatsApp number, other city, consent, duplicate submission, email draft/copy flow, and endpoint success/error/non-JSON/timeout.
- Check header/mobile/footer/app buttons lead to the homepage download section. Both store platforms remain visible with/without valid URLs.
- Run the production build manually. No runtime or visual verification was performed by the agent.

## Locale URL update — 2026-10-25

- User requested `/ar` instead of a language query parameter. Internal links now generate `/ar` and `/en` prefixes, including supporting pages and homepage section anchors.
- Explicit URL locale takes precedence over cookies. Unprefixed and old query-based links are normalized in the browser; old `lang` parameters are removed while other parameters and anchors survive.
- Language switching retains the current route and anchor. A history listener restores the path's language on Back/Forward.
- Cookies continue to remember language/theme. Host fallback remains required for direct localized-page visits.
- Source review only; app execution, builds, and tests remain deferred under the user's no-run instruction.

## Contact field simplification — 2026-10-25

- User requested one phone number and no WhatsApp field. This supersedes the earlier separate-number decision and related manual checks.
- Removed the separate field, checkbox, state, validation, payload property, and email-summary row. Updated both language versions of the form/privacy copy and current documentation.
- The remaining payload matches the old courier-lead field contract; its same-origin and runtime requirements still apply.
- Source edits only; no application, builds, or tests were run.

## Security positioning and copy removals — 2026-10-25

- User requested removal of the greeting CTA and heart-to-door tagline, and described Giftly as the intermediary holding funds until order completion.
- Removed the greeting links from FAQ/footer and tagline from the hero/footer, including English equivalents.
- Added bilingual security copy, an explanatory invoice → hold → completion/release diagram, a footer anchor, and a related FAQ. Reframed existing “Why Giftly” benefits around the payment-intermediary role.
- This supersedes the earlier decision to omit that model from marketing. The known backend payment-disabled status is still acknowledged through a brief availability note; no payment code or backend integration changed.
- Source review and file edits only. No app, build, tests, or browser preview were run.
