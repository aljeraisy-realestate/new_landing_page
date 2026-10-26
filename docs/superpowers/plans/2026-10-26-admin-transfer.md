# Courier CSV import and export

Implement immediately as previously authorized. Use CSV without adding dependencies.

- Export every registration or every match for the active city/mobile/device/status filters, across all pages, without a record-count cap. Stream CSV downloads with UTF-8 BOM, quoted cells and spreadsheet formula protection. Provide an import template.
- Import up to 1,000 rows / 2 MB through a preview with validation errors, duplicate counts and an explicit permission-to-use-data checkbox. Accept reference courier_leads column names plus review metadata. Normalize Saudi phones, resolve city labels, preserve valid timestamps/status/ref, and skip existing phones without updates. Do not fabricate historical consent timestamps.
- Require admin authentication; protect imports with origin/CSRF and rate limits. Validate on the server and use one transaction. Do not alter base schema or existing registrations.
- Add meaningful CSV, storage and HTTP authorization/atomicity tests. Use temporary test databases only. Verify rendering without importing fabricated records into the user's database.

## Review and verification

Implemented the controls, template/preview, protected endpoints and transactional persistence without new dependencies or schema changes. The read-only reviewer found timestamp truncation; canonicalization now retains milliseconds and the dashboard interprets those SQLite timestamps as UTC. Focused tests passed. The browser successfully exported an empty CSV and displayed the import/template controls. No fabricated records were imported into the user's database. The production build passed. Automatic approval review rejected running the full suite because earlier user instructions prohibited it; the suite remains unrun pending explicit approval.
