# Giftly landing page creation prompt

Create and implement an innovative, polished landing page for **Giftly / قيڤتلي**, a Saudi personal gifting app. Work immediately: investigate, plan, then implement without waiting for approval. Deliver the source code only; do not install dependencies, start servers, run builds/tests, launch browsers, or deploy. I will run everything manually.

## Read the product before designing

The new page belongs in `new_lading`. Treat these sibling projects as read-only references:

- `../mobile`: inspect the theme, app screens, components, and screen guide. Original screen PNGs are in `Giftly/Giftly/`; reusable artwork and Tajawal fonts are in `src/assets/`.
- `../backend`: inspect `README.md`, `docs/architecture.md`, and the relevant API contracts to understand actual workflows and current limitations.
- `../landing-page`: use the existing landing components, brand assets, Arabic/English copy, and contact details as context. Create a fresh composition rather than copying the old layout.

Giftly connects a customer with an eligible local courier who helps source, prepare, and deliver a personally described gift. The core journey is: describe a gift, add reference images and a city/date, a courier accepts, coordinate through chat, review an itemized invoice, follow preparation and delivery updates, then view delivery completion and rate the experience. The app also contains occasions/calendar and courier workflows.

Do not invent live features or launch status. The backend currently states that production payment processing is disabled pending Dhamen integration and verification. Do not advertise active payment guarantees or published app-store availability without evidence. Do not add fake testimonials, customer totals, ratings, delivery-time promises, or fake successful form submissions.

## Identity and creative direction

Preserve the mobile identity exactly:

- Primary purple: `#68318E`.
- Lavender: `#C8AFE7`.
- Soft lilac: `#E7DBF3`.
- Pale surface: `#F6F0FA`.
- Ink: `#201B26`.
- White: `#FFFFFF`.
- Use the existing Tajawal typeface, self-hosted with its license. Use the app's recognizable mark and gifting artwork.

Make the page feel thoughtful, personal, playful, and distinctly Giftly. Spend the visual boldness on a large typographic hero and overlapping phones displaying real mobile screen assets. Use gift-ribbon curves, a few restrained gift motifs, expressive headings, generous whitespace, and clear information hierarchy. Keep the surrounding composition calm. Avoid identical generic feature cards, unrelated stock imagery, decorative dashboards, excessive gradients, and constant floating animations.

Suggested headline: **“A little thought. A lot of happy.”** / **“فكرة صغيرة. فرحة كبيرة.”**

## Page narrative

1. A compact sticky navigation with the Giftly identity, workflow/app/benefits anchors, a language switch, and a primary app CTA.
2. A memorable hero explaining what the service does, overlapping actual screen images, and selectable occasion chips such as birthday, thank you, and just because. Each choice changes a short gifting idea.
3. A quiet gifting-value strip that connects the hero to the product story.
4. An interactive “How it works” journey: **create request → chat with courier → review invoice → completed delivery**, each with explanatory content and its matching screen. Support direct selection and Previous/Next controls. Where old exports have irrelevant messages or outdated tax details, use clearly labeled HTML/CSS illustrations based on current mobile code, with sample content; use the original completion image. Make all previews inspectable in the gallery and full-screen viewer.
5. An app gallery showing home, occasions/calendar, tracking, delivery completion, and courier experience. Visitors can switch screens and open a readable, scrollable full-screen preview.
6. A dedicated security section explains Giftly's role as the payment intermediary: invoice review, funds held while the gift is prepared/delivered, then release to the courier after order completion. Use a clear three-stage diagram without pretending it is a live transaction. Keep an availability note while production payments are disabled. The “Why Giftly” section should lead with this user-supplied hold-and-release model, followed by direct coordination, clear invoices, and completion confirmation.
7. A courier invitation explaining the other side of the marketplace. Link to a real contact method; do not pretend that an application has been submitted.
8. Helpful FAQs answering gift requests, courier acceptance, delivery dates, progress tracking, and app availability.
9. A clear final app/launch CTA followed by a useful footer. Use `info@giftly.sa`, the existing public contact address. Omit the greeting CTA and heart-to-door tagline the user asked to remove.

## Screen asset rules

Copy selected PNGs into this project's public assets so the page is self-contained. Display the actual images rather than drawing generic replacement app screens. Keep their proportions and avoid stretching. Long screens must remain inspectable by scrolling or opening a preview.

The mobile folder contains historical design exports. Label them as original app design previews; do not claim they are runtime captures of the latest app. Their language should remain as supplied even when surrounding page copy is English. Check each image before choosing it: some historical chat exports contain irrelevant programming placeholder messages, and historical invoices include tax text that no longer matches the current backend. Do not use those misleading exports to describe the current product.

## Implementation requirements

- Use modern **JavaScript and React**, with **Vite** and the official React plugin. Use npm `latest` stable tags so my first manual installation resolves current stable releases. Keep dependencies minimal; use native CSS for layout and restrained motion.
- Build in the existing empty `new_lading` directory, leaving sibling projects unchanged.
- Default to Arabic RTL at `/ar`, with complete English LTR support at `/en` and a header switch. Use locale-prefixed paths for every page, such as `/ar/privacy` and `/en/privacy`, rather than language query parameters. Save language and light/dark theme preferences in first-party cookies. The URL locale takes precedence; bare paths use the saved choice or Arabic. Preserve the current page and anchor when switching languages, and update document language/direction and metadata. Apply dark styling to every page while preserving original screenshot images.
- Use semantic HTML, accessible tabs with keyboard navigation, clear focus states, an Escape-dismissable native preview dialog with focus restoration, and accessible FAQ disclosures.
- Support 320px mobile through large desktops, text wrapping, touch controls, and reduced-motion preferences.
- Use self-hosted fonts and local images. Load below-the-fold imagery lazily and prioritize the hero screens.
- Configure real HTTPS App Store and Google Play URLs through public environment variables. Keep the official download badge buttons enabled while links are pending; clicking an unconfigured badge shows a clear inline message that its link will be added soon. Do not invent links, disable buttons, or use enquiry email actions here.
- Include dedicated `/couriers`, `/about`, `/privacy`, and `/terms` pages, referenced from giftly.sa and the corresponding old landing source when live subpages cannot be retrieved. Preserve source provenance and provide English translations. Add accurate explanations of preference cookies and courier data handling.
- The courier form collects full name, one mobile number, city, and device type, with Arabic/English validation and explicit contact consent. Submit to the built-in same-origin `/api/courier-leads` endpoint, which validates and stores the application in private SQLite. Support optional referral codes, and do not add customer accounts or payment collection.
- Follow `../landing-page/db/schema.ts` for the physical SQLite base tables, columns, defaults, constraints, and indexes. Use `courier_leads` for the short form, with integer IDs, unique phone, and nullable ref; resolve custom city names directly into city. Keep additional review/consent data separate rather than adding columns to the reference table. Provide a transactional migration preserving existing registrations; do not execute it under the no-run instruction.
- Build administration as a separate HTML/React entry, with `/admin/login` and `/admin/couriers` pages and its own responsive layout without the landing navigation, footer, or marketing content. `/admin` selects the correct page according to the current session. Keep admin imports out of the public application. Review registrations, search/filter them, and save review statuses. Use private ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_JWT_SECRET without defaults. Use the latest jose library for strictly verified 15-minute JWT access tokens, rotating single-use refresh tokens with a three-day deadline from sign-in, automatic renewal, HttpOnly/SameSite Strict cookies (Secure on HTTPS), same-origin/CSRF checks, persistent revocation and replay detection. Store refresh hashes in a separate extension table while preserving the reference base schema. Use rate limits, bound SQL parameters, and paginated reads. Data must remain outside public/build folders and survive server restarts.
- Keep separate iOS and Android download cards visible on the homepage. Use unmodified official Apple App Store and Google Play badge artwork, including the native icons, rather than recreating the marks. Header and supporting-page buttons must lead to that homepage section.
- Use a Node 24+ server with built-in SQLite/crypto and no extra npm dependency. Development should serve Vite and APIs on one origin; production should serve the built frontend and API from that Node service with a persistent data directory. Document credentials, HTTPS public origin, and manual startup commands. Tests may be authored for the user, but do not run them under the no-run instruction.
- Organize source into focused files for localized content, page components, and styling. Include an environment example and a short README with commands for me to run manually.

## Handoff

Supply the complete implementation, the source-asset mapping, and the manual install/dev/build commands. Explain that no runtime checks were executed under my instruction. Do a source review for broken paths, missing translations, misleading claims, and inaccessible controls without running the project. Do not claim visual or runtime verification.
