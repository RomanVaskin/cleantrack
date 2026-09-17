# cleantrack

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_SYq7OyeHc7jdBkffMf3jsc9prjAm)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

## PostgreSQL data layer

The server reads PostgreSQL through `pg`, using ordinary parameterized SQL.
Set `DATABASE_URL` in your local environment (see `.env.example`); never
use a `NEXT_PUBLIC_` variable for database credentials. The lazy pool is shared
per Node.js process and is protected by `server-only`.

For a new, empty local database, apply `db/schema.sql`, then `db/seed.sql`.
These scripts are not run by install, build or application startup. The seed
preserves the demo UUID and does not overwrite existing progress on repeat runs.
This is a fresh schema, not an in-place migration of an existing database.

Without `DATABASE_URL`, both pages use the original mock data and writes succeed
in UI-local state; reloading resets that state. Read failures also retain the
original mock fallback, while configured database write failures return
`{ ok: false }` for the existing UI rollback.

Until authentication is implemented, server writes are limited to
`DEMO_CLEANING_ID` (the seeded UUID by default). Completion checks selected
services inside a transaction; both write actions lock the cleaning first.
The existing selection picker and notes remain local UI state. Changing the selected services locally does not change the database's
completion requirements.

### Local photo storage

Set server-only `CLEANTRACK_UPLOAD_DIR` to a persistent directory outside the
repository. Production uploads require this variable; development defaults to
`os.tmpdir()/cleantrack-photos`. Never use a `NEXT_PUBLIC_` prefix. No production
server configuration is changed by this code.

The cleaner uploads JPEG, PNG or WebP (up to 10 MiB) with a file picker supporting
gallery selection. The server checks MIME and basic file signatures, generates
UUID filenames and stores relative identifiers in PostgreSQL. This is not full
image decoding or resizing. GET `/api/photos/[id]` resolves metadata and reads
only UUID image filenames, refusing symlinks. Existing seeded demo image paths
are matched against the fixed mock photo list; arbitrary stored paths are never
sent to the browser. The client uses the same photos with its existing viewer.

Without DATABASE_URL, demo photos remain visible and uploads fail without writing
files or metadata. Upload/delete controls are absent from the client; endpoints
remain unauthenticated and scoped to the demo cleaning at this stage. Deletion is
not implemented.

Back up files together with PostgreSQL, monitor disk space, and use shared storage
if running multiple instances. A process crash between file write and database
insert can leave an orphan file. Temporary development files may be cleaned by
the OS. Upload files are never stored under public or inside the Git repository.

### Verification

```sh
pnpm install
pnpm build
pnpm exec tsc --noEmit
```

Integration tests require an **empty disposable local PostgreSQL database** and
write test data to it. They use the real data layer with only the Next.js request
boundary stubbed, and check seed idempotency, reads, writes, completion guards,
rollback, and mock/error fallback. No additional test dependency is required.

```sh
CLEANTRACK_TEST_DATABASE_URL=postgresql://localhost:55439/postgres node tests/postgres.cjs
```

Photo integration checks (same disposable database after the test above):

```sh
CLEANTRACK_TEST_DATABASE_URL=postgresql://localhost:55439/postgres node tests/photos.cjs
```
