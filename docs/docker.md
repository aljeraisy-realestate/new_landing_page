# Docker deployment

The service listens on **3000** in every mode. Docker publishes **3000:3000**. There is no PORT variable to configure.

## Prepare private settings

Keep `.env` beside `compose.yaml`. Required management settings are `ADMIN_PATH`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_JWT_SECRET`. Use your intended credentials for deployment; the current local testing credentials are not image defaults. Choose a single non-reserved lowercase path segment for `ADMIN_PATH`. The actual chosen route remains in `.env` and is supplied at runtime, never as a build argument.

Leave `APP_ORIGIN` empty for local `http://localhost:3000`. For a public site set it to the exact HTTPS origin and use an HTTPS reverse proxy. Changing credentials, key, route or origin requires restarting the service. Changing the route does not require rebuilding the image.

## Build and run manually

Start Docker Desktop, then from the project directory:

```powershell
docker compose build
docker compose up -d
docker compose ps
```

Open `http://localhost:3000/ar`. For management append your private `ADMIN_PATH` value to `http://localhost:3000`; its login and courier pages use the same prefix. The old admin URL and API aliases are disabled and do not redirect.

```powershell
docker compose logs --tail 50 giftly
docker compose down
```

The Dockerfile uses the official Node 24 Debian slim image, separates build/runtime dependencies, runs without root, and includes a public-page health check. The configuration follows [Docker's Node guide](https://docs.docker.com/guides/nodejs/) and the [official Node image recommendations](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md).

## Persistent registrations

Compose mounts the `giftly-data` named volume at `/app/data` and sets `SQLITE_DATA_DIR=/app/data`, using the same folder variable as the original landing. An existing `couriers.sqlite` or original nested Wrangler database is reused automatically. Fresh volumes create `/app/data/couriers.sqlite`. Ordinary rebuilds and `docker compose down` retain that volume. Removing volumes deletes the stored registrations; do not use `down -v` to stop a service you intend to keep.

This named volume is separate from the development `data/` folder. To migrate existing data, stop the old service and use SQLite backup tooling or a consistent copy taken while it is stopped, then restore that backup into the container volume before starting the new service. Keep the original folder layout when restoring Wrangler persistence, and keep a separate backup. Do not run both app versions against the same live folder. Remove obsolete `SQLITE_PATH` overrides, or ensure an explicit file is inside `/app/data`. The image build never copies a local database, Wrangler state, or `.env` into image layers.

The runtime user is `node` (UID/GID 1000 in this image). When restoring files from the original container, which ran as root, ensure the mounted folder, database and any WAL/SHM files are writable by that user before starting this service.

## Public store links

`VITE_APP_STORE_URL` and `VITE_PLAY_STORE_URL` are public build arguments populated from Compose's environment interpolation. Rebuild to change them. Authentication settings and the management URL are runtime-only values, excluded from the build context by `.dockerignore`.

## Verification boundary

Compose configuration and the local production bundle can be validated without starting containers. An image build requires a running Docker engine. No server or container is started automatically by the agent after the user's stop request.
