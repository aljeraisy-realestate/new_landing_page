# Private management path and Docker

Continue the user's private-route request and add Docker deployment. Keep development stopped; do not start a container. Production defaults to port 3000 without a PORT setting.

1. Require private ADMIN_PATH in runtime environment; validate one safe, non-reserved URL segment. Store the selected value only in ignored .env. Disable old /admin aliases and the old external /api/admin endpoint.
2. Derive browser management URLs from the currently visited private path. Keep the chosen path out of build variables, public HTML, and public bundles. Scope authentication cookies and API requests to the chosen prefix. Retain authentication/CSRF/rate limits.
3. Serve management documents/assets only through that prefix. Protect direct entry/source requests, disable production source maps, and use a private build manifest to distinguish management-only assets. Clients who legitimately open a page can still inspect its delivered HTML/JS; a private URL is not a substitute for authentication.
4. Add a Node 24 multi-stage Dockerfile, .dockerignore, and Compose service exposing 3000:3000, runtime .env, non-root execution, and persistent SQLite storage. No secrets in image layers or build arguments.
5. Add focused route checks; inspect Docker availability and validate/build only as available without starting the server. Do not run the previously rejected full test suite.

## Outcome

Added Dockerfile/Compose/ignore configuration and runtime-only route handling. Removed old public aliases, scoped API/cookies, and protected direct source/build asset requests. The reviewer identified a path-normalization bypass; the server now rejects ambiguous separators and checks resolved relative asset paths with case normalization. No remaining blocking issues were reported. Focused route/client checks and Compose configuration validation passed; the local production build passed and a scan confirmed the chosen private path is absent from output. Docker CLI is installed but its Linux engine is not running, so the image could not be built or tested. No server or container was started after the stop request.
