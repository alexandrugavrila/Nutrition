# 🤝 Contributing Guide

This guide covers **developer setup, branching, Docker workflows, API & migration handling, testing, and CI**.  
For the high‑level overview and quick start, see [README](README.md).

---

## 🐍 Virtual Environment

All development tasks should run inside the project’s Python virtual environment.  
The activation scripts install backend Python deps and (when needed) frontend Node deps.

**Windows (PowerShell):**
```powershell
pwsh ./scripts/env/activate-venv.ps1
````

**macOS/Linux (Bash):**

```bash
source ./scripts/env/activate-venv.sh
```

Many helper scripts (e.g., `run-e2e-tests` and `import-from-csv`) automatically
activate the virtual environment when `VIRTUAL_ENV` is unset, so they can be run
directly.

---

## 🔀 Branching

Use:

```
[type]/issue-in-kabob-case
```

**Types:** `feature`, `refactor`, `bugfix`, `housekeeping`

---

## 🐳 Docker Workflows

> Use the helper scripts per branch (don’t call `docker compose` directly) so ports and names stay isolated.

**Start services (choose a data seed):**

```pwsh
pwsh ./scripts/docker/compose.ps1 up data -test    # or data -prod
```

Ensures:

* Correct **per-branch project name**
* Correct **branch-specific ports**
* Sets `DATABASE_URL` for local utilities to match the branch's DB port
* Optional CSV import (based on mode)

Compose-up behavior:

- Waits for the Postgres service to become healthy.
- Waits for the backend container to finish installing deps (verifies `alembic` is present).
- Runs Alembic migrations inside the backend container: `python -m alembic upgrade head`.
- Seeds data based on `data -test` or `data -prod`.

**Stop services:**

```pwsh
pwsh ./scripts/docker/compose.ps1 down
```

Behavior and options:

* Defaults to the current branch's stack (non-interactive).
* Volumes (including branch-specific `node_modules` cache) are removed by default for clean isolation
* Add `type -test` to target the dedicated test stack (if you used it)

**Restart services:**

```pwsh
pwsh ./scripts/docker/compose.ps1 restart data -test    # or data -prod
```

Stops and then starts the current branch's containers with the chosen data seed. Use `type -test` if you want to target the TEST ports/project.

### Import data from CSV

Re-import seed data into the running branch database:

```bash
./scripts/db/import-from-csv.sh -production   # or -test
pwsh ./scripts/db/import-from-csv.ps1 -production   # or -test
```

These helpers require the branch's containers to be running and automatically
activate the virtual environment if needed.

Notes:
- The CSV importer detects an empty schema and will automatically run `alembic upgrade head` using the current `DATABASE_URL` before importing data.
- When no tables are present it skips the TRUNCATE step to avoid SQL errors, then re-checks table order post-migration.
- If there is a version mismatch between the imported backup and the current db migration
  Clean restore of the latest dump for this branch:
    PowerShell: pwsh ./scripts/db/restore.ps1 -ResetSchema
    Bash: ./scripts/db/restore.sh --reset-schema
  Clean restore then migrate to head:
    PowerShell: pwsh ./scripts/db/restore.ps1 -ResetSchema -UpgradeAfter
    Bash: ./scripts/db/restore.sh --reset-schema --upgrade-after

---

## ⚙️ Port Mapping

Each branch gets unique host ports: **base + branch offset (hash of branch name)**

| Service  | Base | Example (`feature/x`) |
| -------- | ---- | --------------------- |
| Frontend | 3000 | 3004                  |
| Backend  | 8000 | 8006                  |
| DB       | 5432 | 5438                  |

Printed on startup and visible in Docker Desktop as `HOST:CONTAINER`.

### Testing-Only Ports (ephemeral scripts)

In addition to the dev ports above, the branch environment exports a separate set of testing ports that are reserved for scripts which spin up a dedicated container, run work, and then tear it down.

- `TEST_FRONTEND_PORT` base: `13000 + offset`
- `TEST_BACKEND_PORT` base: `18000 + offset`
- `TEST_DB_PORT` base: `15432 + offset`

Scripts that manage their own temporary containers (e.g., migration drift checks) will prefer `TEST_*` ports when they're set to avoid colliding with your running dev stack.

Examples:

- `scripts/check-migration-drift.(ps1|sh)` starts a temporary Postgres and uses `TEST_DB_PORT`.
- `scripts/sync-api-and-migrations.sh` starts a temporary Postgres compose project (per-branch) bound to `TEST_DB_PORT` and sets `DATABASE_URL` accordingly.

Notes:

- The frontend dev server binds to `0.0.0.0` and uses a strict port. Use the printed host port (e.g., `http://localhost:<DEV_FRONTEND_PORT>`).

---

## 🌐 Environment Variables

- `DEV_BACKEND_PORT` → backend service port (defaults to `8000`; compose scripts set this automatically)
- `BACKEND_URL` → full URL for the backend API. The frontend dev server proxies `/api` to this value. If unset, it falls back to `http://localhost:${DEV_BACKEND_PORT}`.

---

## 🖥️ Local Development (Non‑Docker)

**Backend (FastAPI):**

```bash
# First: activate venv (see above)
uvicorn Backend.backend:app --reload
```

**Frontend (React):**

```bash
npm --prefix Frontend run dev     # start dev server
npm --prefix Frontend run build   # production build
npm --prefix Frontend run preview # preview build
```

---

## 🧪 Testing

- Run backend and frontend unit tests:
  - Bash: `./scripts/run-tests.sh`
  - PowerShell: `pwsh ./scripts/run-tests.ps1`
  - Flags:
    - Include e2e: `--e2e` (Bash) or `-e2e` (PowerShell)
    - Sync models/API (OpenAPI + types + migration drift): `--sync` (Bash) or `-sync` (PowerShell)
    - Full (sync + e2e): `--full` (Bash) or `-full` (PowerShell)

- End-to-end API tests only (require Docker stack):
  - Auto-skip: The e2e module skips itself when `DEV_BACKEND_PORT` is missing or the backend is unreachable.
  - Run via helper script (brings stack up if needed):
    - Bash: `./scripts/tests/run-e2e-tests.sh`
    - PowerShell: `pwsh ./scripts/tests/run-e2e-tests.ps1`
  - Pass extra pytest args as needed:
    - `./scripts/tests/run-e2e-tests.sh -q -k ingredient`
    - `pwsh ./scripts/tests/run-e2e-tests.ps1 -q -k ingredient`
  - These helpers automatically activate the virtual environment if required.

Notes:
- The helper starts a dedicated test stack (`type -test data -test`) on TEST ports, waits for readiness, runs the e2e suite, and tears the stack down afterward.
- You can still pass your own pytest flags to tailor verbosity (e.g., `-q`, `-k`, etc.).
- The script leaves containers running; use `scripts/docker/compose.ps1 down` (or `scripts/docker/compose.sh down`) to stop them when done.

---

## 📚 API & Migrations Handling

**Canonical workflow (one script does it all):**

```powershell
pwsh ./scripts/db/sync-api-and-migrations.ps1
```

This orchestrates:

1. **OpenAPI schema + frontend TypeScript types**

* Runs `scripts/db/update-api-schema.ps1`
* Exports `/openapi.json` → `Backend/openapi.json`
* Regenerates types → `Frontend/src/api-types.ts`
* If `git` is available, compares changes and (in interactive mode) lets you **keep** or **revert**

2. **Migration drift detection/adoption**

* Runs `scripts/db/check-migration-drift.ps1`
* Starts a temporary Postgres DB
* Applies all migrations
* Autogenerates a revision to detect drift
* If drift exists, **adopts** it as a new migration file, reapplies, and verifies clean

**Exit codes (from the drift step):**

* `0` → Up to date (already clean or clean after adoption)
* `1` → Script/tooling error
* `2` → Continued drift after adoption (investigate manually)

👉 **Normal development**: run the script, review changes, and commit any new migration(s), `Backend/openapi.json`, and `Frontend/src/api-types.ts`.

### 🛠️ Manual Workflows (Fallbacks)

#### Alembic (Database Migrations)

```bash
# Create a migration after editing models
alembic revision --autogenerate -m "describe change"

# Apply migrations
alembic upgrade head

# Reset database
alembic downgrade base && alembic upgrade head
```

#### Drift Check Only

```powershell
pwsh ./scripts/db/check-migration-drift.ps1
```

#### OpenAPI Schema / Frontend Types

```bash
# Regenerate both with the helper
scripts/db/update-api-schema.sh
```

Or step-by-step:

```bash
uvicorn Backend.backend:app --port 8000 &
curl http://localhost:8000/openapi.json -o Backend/openapi.json
npx openapi-typescript Backend/openapi.json -o Frontend/src/api-types.ts
kill %1
```

#### Database Backups & Restores

Create a snapshot of the branch-local Postgres database:

```bash
./scripts/db/backup.sh
# or
pwsh ./scripts/db/backup.ps1
```

This writes a custom-format dump and a sidecar JSON metadata file containing the Alembic revision and git commit, e.g.:

- `Database/backups/<branch>-<timestamp>.dump`
- `Database/backups/<branch>-<timestamp>.dump.meta.json`

Restore a dump into the branch-local database (containers must be running):

```bash
./scripts/db/restore.sh [--upgrade-after] [--fail-on-mismatch] Database/backups/<file>
pwsh ./scripts/db/restore.ps1 [-UpgradeAfter] [-FailOnMismatch] Database/backups/<file>
```

Both scripts target `postgresql://localhost:<DEV_DB_PORT>/nutrition` and refuse to run against non-local hosts.

Behavior notes:

- On restore, if the metadata file exists, the script prints the backup's Alembic revision and compares it to the repo head(s) when Alembic is available.
- Add `--fail-on-mismatch`/`-FailOnMismatch` to abort when the backup revision does not match the repo head(s).
- Add `--upgrade-after`/`-UpgradeAfter` to run `alembic upgrade head` after the restore (recommended when restoring an older dump).

---

## 🛠️ Tools

### DBeaver (optional)

* **Host:** `localhost`
* **Port:** `<DEV_DB_PORT>` (printed at startup)
* **DB:** `nutrition`
* **User:** `nutrition_user`
* **Pass:** `nutrition_pass`

---

## ✅ Typical Commit Checklist

Before opening a PR:

* [ ] **Models changed?**
  Run `pwsh ./scripts/db/sync-api-and-migrations.ps1`
  → Commit any new migration(s), `Backend/openapi.json`, `Frontend/src/api-types.ts`
* [ ] **API endpoints updated?**
  Confirm new paths (e.g., `/foods`) after running migrations and update docs and clients as needed.
* [ ] **Frontend API usage added/changed?**
  Ensure `Frontend/src/api-types.ts` is current (via the sync script)
* [ ] **Migrations apply cleanly?**
  `alembic upgrade head` (or rely on the sync/drift script outcome)
* [ ] **Tests pass?**
  `./scripts/run-tests.sh` (or `pwsh ./scripts/run-tests.ps1`)
  - Excludes e2e by default. Include with `--e2e`/`-e2e`.
  - Run model/API sync first with `--sync`/`-sync`, or do both with `--full`/`-full`.
* [ ] **Lint/build ok?**
  `npm --prefix Frontend run lint` and `npm --prefix Frontend run build`

---

## 🧪 Continuous Integration (GitHub Actions)

The repo includes a **two‑job CI**: `backend` and `frontend`.

### `backend` job (Ubuntu + Postgres service)

* **Services → Postgres 13**
  Spins up a DB with health checks. Exposes `postgres:5432` to the job via Docker networking.
  Sets `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nutrition` for the app.

* **Environment & toolchain**

  * Checks out the repo
  * Installs Python 3.11 and Node 20
  * Caches **pip** (`~/.cache/pip`) keyed by `Backend/requirements.txt`
  * Activates venv via `scripts/env/activate-venv.sh` and installs `pytest`

* **Migration drift gate**

  ```bash
  source scripts/env/activate-venv.sh
  scripts/db/check-migration-drift.sh
  git diff --exit-code Backend/migrations/versions
  ```

  Runs the Bash version of the drift check; then fails the build if it detects **uncommitted** migration file changes (enforces “migrations committed” policy).

* **Installs frontend deps (for schema generation)**
  `npm ci` in `Frontend/` (used later when generating types from OpenAPI).

* **Runs Alembic migrations**
  `alembic upgrade head` applies the schema to the CI Postgres.

* **Updates API schema**

  ```bash
  source scripts/env/activate-venv.sh
  export DEV_BACKEND_PORT=8000
  scripts/db/update-api-schema.sh
  ```

  Starts a temporary server, exports `Backend/openapi.json`, regenerates `Frontend/src/api-types.ts`.

* **Schema unchanged gate**

  ```bash
  git diff --exit-code Backend/openapi.json Frontend/src/api-types.ts
  ```

  Fails if the OpenAPI spec or types are out of date (enforces “generate & commit API artifacts”).

* **Tests**
  `./scripts/run-tests.sh` executes backend (pytest) and frontend (npm test) suites.

* **DB teardown (always runs)**
  Drops and recreates the `public` schema to leave the container clean.

**Why these gates?**

* **Drift gate** ensures developers include migrations when models change.
* **Schema gate** ensures OpenAPI + TS types are regenerated and committed with API changes.

### `frontend` job

* Checks out repo and sets up Node 20
* Caches npm modules (`~/.npm`) keyed by `Frontend/package-lock.json`
* `npm ci` installs exact deps
* `npm --prefix Frontend run lint` enforces code quality
* `npm --prefix Frontend run build` ensures the app builds for production

**Benefits:**

* Caching speeds up repeated CI runs
* Frontend job is independent of the backend DB and focuses on build quality
* Backend job validates migrations and API contract artifacts

---

## 📚 Troubleshooting

* **“No changes detected”** during autogenerate
  Ensure new models are **imported** in `alembic/env.py`.
* **Migration fails to apply**
  Verify `DATABASE_URL` points to the running service (local or CI).
* **Stuck DB state**
  `alembic downgrade base && alembic upgrade head` to reset schema.
* **Frontend can't reach backend**
  Ensure `DEV_BACKEND_PORT` or `BACKEND_URL` is set so the dev proxy knows where to forward API calls.
* **`/openapi.json` 404**
  Confirm the backend server is running and you’re using the correct `DEV_BACKEND_PORT`.
* **CI drift/schema gates failing**
  Run the **sync script** locally, review diffs, and **commit generated files**.

---

Thanks for contributing! 🎉
