# Contributing Guide

This guide covers developer setup, branching, Docker workflows, API and migration handling, testing, and CI. For the quick overview see [README](README.md).

---

## Virtual Environment

- Each worktree maintains its own `.venv` folder.
- Windows and PowerShell:
  ```pwsh
  pwsh ./scripts/env/activate-venv.ps1
  ```
- macOS and Linux:
  ```bash
  source ./scripts/env/activate-venv.sh
  ```
- Run `pwsh ./scripts/env/check.ps1 -Fix` or `./scripts/env/check.sh --fix` to ensure you are inside the expected worktree, the default branch lives in the primary clone, and the virtual environment is active. The fixer creates missing worktrees, activates the venv, and switches directories when it is safe.
- Most helper scripts auto-activate the virtualenv when `VIRTUAL_ENV` is unset, so you can run them directly.

---

## Branching & Worktrees

Branch naming pattern: `<type>/<slug>` where `type` is one of `feature`, `bugfix`, `refactor`, or `housekeeping`.

Recommended flow when starting or updating a branch:

1. Sync remote refs and audit existing worktrees:

   ```pwsh
   pwsh ./scripts/repo/check.ps1
   # or
   ./scripts/repo/check.sh
   ```

   The command runs `sync-branches` (fetch, prune, create local tracking branches), `audit-worktrees` (ensures every branch maps to exactly one worktree, the default branch stays in the primary clone, and no worktree is detached), and `audit-container-sets` (flags Docker Compose projects for branches that no longer exist).

2. Create or switch to the branch in Git:

   ```pwsh
   git switch -c feature/my-feature   # or git switch feature/my-feature
   ```

3. Create or jump into the branch worktree:

   ```pwsh
   pwsh ./scripts/switch-worktree-branch.ps1 feature/my-feature
   ```

   The script creates `../nutrition-feature-my-feature` if needed, checks out the branch there, and optionally opens VS Code. Pass `-SkipVSCode` to stay in the terminal or `-NewVSCodeWindow` for a new window.

4. Verify the environment:

   ```pwsh
   pwsh ./scripts/env/check.ps1 -Fix
   # Bash
   ./scripts/env/check.sh --fix
   ```

   `-Fix` creates missing worktrees, switches to them, and activates `.venv` when it is safe to do so.

Worktree conventions:

- `main` (or the repository's default branch) remains in the original clone (the "primary root").
- Every other branch should live in a sibling directory named `nutrition-<sanitized-branch>`; all helper scripts rely on this layout to compute per-branch ports, compose project names, and database volumes.
- The helpers error out on detached HEADs or mismatched worktree locations to avoid running the wrong stack.

Other repo utilities:

- `pwsh ./scripts/repo/sync-branches.ps1 [-DryRun] [-NoFetch]`: refresh local branches, pruning deleted refs, and optionally create worktrees for new branches.
- `pwsh ./scripts/repo/audit-worktrees.ps1`: report orphaned or misconfigured worktrees without fetching.
- `pwsh ./scripts/repo/audit-container-sets.ps1`: flag Docker Compose projects whose branches no longer exist.
- Bash equivalents for both commands live next to the PowerShell versions.

---

## Docker Workflows

Always use the wrapper scripts instead of calling `docker compose` directly; they load branch metadata and enforce the naming scheme.

Start services (choose a seed dataset):

```pwsh
pwsh ./scripts/docker/compose.ps1 up data -test     # test fixtures
pwsh ./scripts/docker/compose.ps1 up data -prod     # production-like fixtures
```

Options:

- Add `type -test` to run on the dedicated test ports (`TEST_*`). Useful for end-to-end runs that should not collide with your dev stack.
- Append service names (e.g. `frontend backend`) to limit which containers start.
- The script waits for PostgreSQL, ensures the backend dependencies are present, runs Alembic migrations inside the container, and seeds data based on the `data` flag.

Stop services:

```pwsh
pwsh ./scripts/docker/compose.ps1 down
# add `type -test` to target the test stack
```

`down` removes branch-specific volumes by default for clean isolation. Pass `-- [compose args]` if you need custom Docker flags.

Restart services:

```pwsh
pwsh ./scripts/docker/compose.ps1 restart data -test
```

Branch-aware environment variables exported by the wrapper:

| Variable             | Description                                        |
| -------------------- | -------------------------------------------------- |
| `DEV_FRONTEND_PORT`  | Vite dev server port (base 3000 + offset)          |
| `DEV_BACKEND_PORT`   | FastAPI dev port (base 8000 + offset)              |
| `DEV_DB_PORT`        | Postgres dev port (base 5432 + offset)             |
| `TEST_*`             | Ports for temporary stacks spun up by scripts      |
| `COMPOSE_PROJECT`    | `nutrition-<sanitized-branch>`                     |
| `DATABASE_URL`       | Branch-local connection string                     |

Multiple branches can run simultaneously because each stack has a unique project name, volume suffix, and port offset.

---

## Database Utilities

All database helpers live under `scripts/db/` and respect the current branch's environment variables.

- `pwsh ./scripts/db/backup.ps1` / `./scripts/db/backup.sh`  
  Writes `Database/backups/<sanitized>-<timestamp>.dump` plus metadata (Alembic revision, git SHA).
- `pwsh ./scripts/db/restore.ps1 [-ResetSchema] [-UpgradeAfter] [<file>]`  
  Restores the most recent dump for the branch or a provided file. `-ResetSchema` drops/recreates the public schema; `-UpgradeAfter` reapplies migrations.
- `pwsh ./scripts/db/export-to-csv.ps1 [-Production|-Test] [-OutputDir <path>]`  
  Writes the current database tables to CSV (defaults to production data). Bash: `./scripts/db/export-to-csv.sh`.
- `pwsh ./scripts/db/import-from-csv.ps1 [-test|-production]`  
  Loads CSV seed data into the running container; used automatically for `compose.ps1 up data -test`.
- `pwsh ./scripts/db/check-migration-drift.ps1`  
  Compares the migration state between the database and `Backend/migrations`.
- `pwsh ./scripts/db/update-api-schema.ps1`  
  Spins up a temporary backend, regenerates `Backend/openapi.json`, and updates `Frontend/src/api-types.ts`.
- `pwsh ./scripts/db/sync-api-and-migrations.ps1`  
  One-stop command: runs Alembic autogenerate, formats new migrations, updates OpenAPI + TS types, runs drift checks, and prompts you to commit generated artifacts.

Most scripts accept Bash equivalents with the same flags.

---

## Testing

Run the combined test suite:

```pwsh
pwsh ./scripts/run-tests.ps1            # pytest + frontend tests
pwsh ./scripts/run-tests.ps1 -sync      # run API/migration sync first
pwsh ./scripts/run-tests.ps1 -e2e       # include end-to-end API tests
pwsh ./scripts/run-tests.ps1 -full      # sync + unit + e2e
```

Bash: `./scripts/run-tests.sh` using the same flags (`--sync`, `--e2e`, `--full`).

End-to-end API tests can also be invoked directly:

```pwsh
pwsh ./scripts/tests/run-e2e-tests.ps1
./scripts/tests/run-e2e-tests.sh
```

The e2e runners launch a temporary stack on the `TEST_*` ports and clean up after completion.

Additional tooling:

- `npm --prefix Frontend run lint`
- `npm --prefix Frontend run build`
- `npm --prefix Frontend test`
- `pytest` (when running backend unit tests outside the wrapper)

---

## Tooling & Ports

- Vite dev server: `http://localhost:$DEV_FRONTEND_PORT`
- FastAPI docs: `http://localhost:$DEV_BACKEND_PORT/docs`
- Postgres: `localhost:$DEV_DB_PORT`, database `nutrition`, user `nutrition_user`, password `nutrition_pass`
- Optional DB client: DBeaver or psql using the above credentials.

---

## Troubleshooting

- **"Branch should be in its dedicated worktree"**  
  Run `pwsh ./scripts/env/check.ps1 -Fix` or manually create the worktree: `git worktree add ../nutrition-<sanitized> <branch>`.
- **Detached HEAD**  
  Switch to a named branch before running the helpers.
- **Compose script exits early**  
  Ensure Docker Desktop is running and you selected a `data` mode.
- **Database restore fails on dependencies**  
  Re-run with `-ResetSchema` (PowerShell) or `--reset-schema` (Bash), then rerun migrations.
- **API schema or migrations drift gate fails in CI**  
  Run `pwsh ./scripts/db/sync-api-and-migrations.ps1`, review diffs, and commit generated files.

---

## Typical Commit Checklist

- [ ] Run `pwsh ./scripts/db/sync-api-and-migrations.ps1` when models or API routes change; commit new migrations, `Backend/openapi.json`, and `Frontend/src/api-types.ts`.
- [ ] Verify `pwsh ./scripts/db/check-migration-drift.ps1` reports no drift.
- [ ] Run `pwsh ./scripts/run-tests.ps1 -full` (or at minimum `./scripts/run-tests.sh --sync`).
- [ ] Ensure frontend lint/build succeed: `npm --prefix Frontend run lint` and `npm --prefix Frontend run build`.
- [ ] Snapshot database if needed: `pwsh ./scripts/db/backup.ps1`.
- [ ] Run `pwsh ./scripts/repo/check.ps1` to confirm worktrees and branches remain aligned.

---

## Continuous Integration (GitHub Actions)

The workflow contains a **backend** job and a **frontend** job.

### Backend job

- Spins up PostgreSQL 13 as a service.
- Checks out the repo, sets up Python 3.11 and Node 20.
- Caches pip and npm dependencies.
- Activates the virtualenv via `scripts/env/activate-venv.sh`.
- Runs `scripts/db/check-migration-drift.sh`; fails if migrations are missing.
- Runs Alembic migrations against the service database.
- Executes `scripts/db/update-api-schema.sh` to regenerate OpenAPI + TS types; fails if diffs remain.
- Runs `./scripts/run-tests.sh --sync` (unit + frontend tests).
- Cleans the database schema on exit.

### Frontend job

- Installs Node 20.
- Caches npm modules.
- Runs `npm --prefix Frontend run lint` and `npm --prefix Frontend run build`.

---

Thanks for contributing!
