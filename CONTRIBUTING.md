# 🤝 Contributing Guide

This guide covers **developer setup, branching, Docker workflows, API & migration handling, testing, and CI**.  
For the high‑level overview and quick start, see [README](README.md).

---

## 🐍 Virtual Environment

All development tasks should run inside the project’s Python virtual environment.  
The activation scripts install backend Python deps and (when needed) frontend Node deps.

**Windows (PowerShell):**
```powershell
pwsh ./scripts/activate-venv.ps1
````

**macOS/Linux (Bash):**

```bash
source ./scripts/activate-venv.sh
```

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

**Start services (choose one seed mode):**

```pwsh
pwsh ./scripts/compose-up-branch.ps1 -test      # or -production / -empty
```

Ensures:

* Correct **per-branch project name**
* Correct **branch-specific ports**
* Optional CSV import (based on mode)

**Stop services:**

```pwsh
pwsh ./scripts/compose-down-branch.ps1
```

Options:

* `-Force` → skip confirmation
* `-PruneImages` → also remove built images
* Volumes are removed by default for clean isolation

---

## ⚙️ Port Mapping

Each branch gets unique host ports: **base + branch offset (hash of branch name)**

| Service  | Base | Example (`feature/x`) |
| -------- | ---- | --------------------- |
| Frontend | 3000 | 3004                  |
| Backend  | 8000 | 8006                  |
| DB       | 5432 | 5438                  |

Printed on startup and visible in Docker Desktop as `HOST:CONTAINER`.

---

## 🖥️ Local Development (Non‑Docker)

**Backend (FastAPI):**

```bash
# First: activate venv (see above)
uvicorn Backend.backend:app --reload
```

**Frontend (React):**

```bash
cd Frontend
npm start
```

---

## 📚 API & Migrations Handling

**Canonical workflow (one script does it all):**

```powershell
pwsh ./scripts/sync-api-and-migrations.ps1
```

This orchestrates:

1. **OpenAPI schema + frontend TypeScript types**

* Runs `update-api-schema.ps1`
* Exports `/openapi.json` → `Backend/openapi.json`
* Regenerates types → `Frontend/src/api-types.ts`
* If `git` is available, compares changes and (in interactive mode) lets you **keep** or **revert**

2. **Migration drift detection/adoption**

* Runs `check-migration-drift.ps1`
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
pwsh ./scripts/check-migration-drift.ps1
```

#### OpenAPI Schema / Frontend Types

```bash
# Regenerate both with the helper
scripts/update-api-schema.sh
```

Or step-by-step:

```bash
uvicorn Backend.backend:app --port 8000 &
curl http://localhost:8000/openapi.json -o Backend/openapi.json
npx openapi-typescript Backend/openapi.json -o Frontend/src/api-types.ts
kill %1
```

---

## 🛠️ Tools

### DBeaver (optional)

* **Host:** `localhost`
* **Port:** `<DB_PORT>` (printed at startup)
* **DB:** `nutrition`
* **User:** `nutrition_user`
* **Pass:** `nutrition_pass`

---

## ✅ Typical Commit Checklist

Before opening a PR:

* [ ] **Models changed?**
  Run `pwsh ./scripts/sync-api-and-migrations.ps1`
  → Commit any new migration(s), `Backend/openapi.json`, `Frontend/src/api-types.ts`
* [ ] **Frontend API usage added/changed?**
  Ensure `Frontend/src/api-types.ts` is current (via the sync script)
* [ ] **Migrations apply cleanly?**
  `alembic upgrade head` (or rely on the sync/drift script outcome)
* [ ] **Tests pass?**
  `pytest` (backend) and `npm test` (frontend)
* [ ] **Lint/build ok?**
  `npm run lint` and `npm run build` (frontend)

---

## 🧪 Continuous Integration (GitHub Actions)

The repo includes a **two‑job CI**: `backend` and `frontend`.

### `backend` job (Ubuntu + Postgres service)

* **Services → Postgres 16**
  Spins up a DB with health checks. Exposes `postgres:5432` to the job via Docker networking.
  Sets `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nutrition` for the app.

* **Environment & toolchain**

  * Checks out the repo
  * Installs Python 3.11 and Node 20
  * Caches **pip** (`~/.cache/pip`) keyed by `Backend/requirements.txt`
  * Activates venv via `scripts/activate-venv.sh` and installs `pytest`

* **Migration drift gate**

  ```bash
  source scripts/activate-venv.sh
  scripts/check-migration-drift.sh
  git diff --exit-code Backend/migrations/versions
  ```

  Runs the Bash version of the drift check; then fails the build if it detects **uncommitted** migration file changes (enforces “migrations committed” policy).

* **Installs frontend deps (for schema generation)**
  `npm ci` in `Frontend/` (used later when generating types from OpenAPI).

* **Runs Alembic migrations**
  `alembic upgrade head` applies the schema to the CI Postgres.

* **Updates API schema**

  ```bash
  source scripts/activate-venv.sh
  export BACKEND_PORT=8000
  scripts/update-api-schema.sh
  ```

  Starts a temporary server, exports `Backend/openapi.json`, regenerates `Frontend/src/api-types.ts`.

* **Schema unchanged gate**

  ```bash
  git diff --exit-code Backend/openapi.json Frontend/src/api-types.ts
  ```

  Fails if the OpenAPI spec or types are out of date (enforces “generate & commit API artifacts”).

* **Backend tests**
  `pytest` executes backend unit tests against the live CI DB.

* **DB teardown (always runs)**
  Drops and recreates the `public` schema to leave the container clean.

**Why these gates?**

* **Drift gate** ensures developers include migrations when models change.
* **Schema gate** ensures OpenAPI + TS types are regenerated and committed with API changes.

### `frontend` job

* Checks out repo and sets up Node 20
* Caches npm modules (`~/.npm`) keyed by `Frontend/package-lock.json`
* `npm ci` installs exact deps
* `npm run lint` enforces code quality
* `npm test -- --watchAll=false` runs unit tests in CI mode
* `npm run build` ensures the app builds for production

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
* **`/openapi.json` 404**
  Confirm the backend server is running and you’re using the correct `BACKEND_PORT`.
* **CI drift/schema gates failing**
  Run the **sync script** locally, review diffs, and **commit generated files**.

---

Thanks for contributing! 🎉
