# Giftly Landing Implementation Plan

> Implement directly in this session, as requested. No approval checkpoint, installation, app execution, build, browser launch, or test execution.

**Goal:** Build a distinctive bilingual landing page and supply a reusable creation prompt.

**Architecture:** Standalone React JavaScript application in the empty `new_lading` directory. Vite handles development and static production output. The mobile, backend, and old landing directories are read-only references.

**Tech stack:** React, React DOM, Vite, official React plugin; npm `latest` stable tags resolve at the user's manual installation. Native CSS supplies responsive layout and restrained motion.

**Design/source brief:** `PROMPT.md`.

## Constraints and design

- Brand: #68318E purple, #C8AFE7 lavender, #E7DBF3 lilac, #F6F0FA pale surface, #201B26 ink, white.
- Typography: self-hosted Tajawal from mobile for brand continuity, with clear display hierarchy.
- Composition: text and overlapping real-screen phones in a lavender hero; a dark-purple interactive workflow; quiet gallery, benefits, courier section, FAQs, and launch CTA.
- Use actual mobile reference PNGs with provenance. Do not present historical screenshots as current runtime captures. Exclude historical invoice screenshots containing VAT and irrelevant chat placeholders.
- Preserve English LTR and Arabic RTL, keyboard support, visible focus, reduced motion, and mobile layouts.
- No invented store URLs, testimonials, usage counts, production payment availability, or submitted-data success states.
- No backend connection required for the marketing page. Contact and launch enquiries go to the existing public info@giftly.sa address.

## Implementation sequence

1. [x] Read product, brand, source screens, existing landing, and backend workflow constraints.
2. [x] Write setup files, brief/prompt, and manual run instructions.
3. [x] Copy the selected original screenshots, artwork, and font assets into public assets.
4. [x] Implement localized content, screen gallery, workflow controls, accessible screen dialog, mobile navigation, FAQs, and configured download links.
5. [x] Implement responsive styling and reduced-motion behavior.
6. [x] Review source paths, imports, interaction states, translations, and claims by reading the finished files. This is source review only; runtime and visual verification are deferred.

## Manual verification for the user

- Install dependencies, then run development server and production build.
- Check desktop, 390px, 320px, zoomed text, English LTR, and Arabic RTL.
- Activate each occasion, workflow step, and gallery tab; open and close the screenshot dialog using mouse and keyboard, including Escape.
- Check mobile navigation closes after selection and language switching.
- Check empty store configuration leads to launch enquiry and configured official store URLs open correctly.
- Check reduced-motion preference removes decorative motion and screenshot images remain readable and scrollable.

## Execution record

- Runtime verification is intentionally deferred to the user under the explicit no-run instruction.
- Source references and latest-release metadata were read; nothing was installed or launched.
- Source review covered image/font paths, English/Arabic content, tab keyboard handling, dialog lifecycle, anchor destinations, configured store hosts, and mobile/RTL styles. The mobile hero uses grid centering in both directions, and desktop columns permit shrinkage rather than inheriting the fixed collage width.

## Workflow refinement — 2026-10-25

- User requested ordering, chat, invoice, and completion screens in “How it works.”
- Replaced generic home/courier/tracking stage previews with request, chat, invoice, and the original delivered screen, in that order. Added bounded Previous/Next controls and derived counters from the step list.
- Added labeled, localized HTML/CSS mobile illustrations for request/chat/invoice using current mobile screen code. Old chat placeholders and outdated invoice tax copy remain excluded. Sample invoice amounts are illustrative; no live order/payment is implied.
- Reused the new previews in the gallery and full-screen dialog and assigned icons directly in the screen manifest.
- Kept preview controls clear of the explanatory panel overlay by increasing the workflow display space.
- Source review only. No installation, app execution, build, browser preview, or tests, under the user's continuing no-run instruction.
