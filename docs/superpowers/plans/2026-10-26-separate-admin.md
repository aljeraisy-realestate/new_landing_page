# Standalone administration pages

The user requested administration outside the landing layout. Implement a separate HTML/React entry, not a conditional section inside the public site.

1. Route /admin and its login/courier pages to the admin HTML document in development and production; keep locale aliases working.
2. Extract only shared branding/icons. Public pages must not import the admin application or its authentication client.
3. Give administration its own responsive header, main region, language/theme controls and login/dashboard URLs. Preserve existing JWT/CSRF behavior and saved preferences.
4. Keep public download badge styles in the public stylesheet; load admin styles only with administration.
5. Author route coverage and inspect the changed source. Do not install, run, build, test or migrate: execution remains reserved for the user.

## Source review

Implemented the separate documents/entries, canonical login and courier routes, shared UI extraction, and CSS split. A read-only reviewer inspected server routing, auth callbacks, build configuration, and the extracted UI and reported no actionable findings. Route tests were authored but not run. The user must manually restart development for the changed Node routing, or rebuild both entries for production.
