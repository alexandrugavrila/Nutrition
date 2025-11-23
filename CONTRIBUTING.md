# Contributing Guide

This guide covers developer setup, branching, Docker workflows, API and migration handling, testing, and CI. For the quick overview see [README](README.md).

---

## Virtual Environment

- Each worktree maintains its own `.venv` folder.
- Windows and PowerShell:
  ```pwsh
  pwsh ./scripts/env/activate-venv.ps1
  ```
- On Windows, allow the helper scripts to run by unblocking them and loosening the execution policy for the current user:
  ```pwsh
  Get-ChildItem -Recurse -Filter *.ps1 | Unblock-File
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
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

`down` removes branch-specific volumes by default for clean isolation. The wrapper does not forward extra Docker Compose flags for
this subcommand—if you need a different teardown (for example, keeping volumes or removing additional resources) run `docker
compose` directly with the branch project name that `up` prints (e.g. `docker compose -p nutrition-my-branch down`).

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

All database helpers live under `scripts/db/` and respect the current branch's environment variables. Detailed usage for every script—including call chains and flags—lives in the [Script catalog](#script-catalog--call-graph), but the short list below highlights the most common flows.

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

## Script Catalog & Call Graph

The repository keeps Bash and PowerShell twins for every contributor-facing script. Use either flavor on any platform; functionality and options match unless noted.

### Testing and quality gates

- `scripts/run-tests.ps1` / `scripts/run-tests.sh`
  - Purpose: run backend unit tests, frontend unit tests, optional OpenAPI/migration sync, and optional end-to-end API tests.
  - Flags:
    - PowerShell: `-e2e`, `-sync`, `-full` (equivalent to both flags).
    - Bash: `--e2e`, `--sync`, `--full` (plus `-h|--help`).
  - Call graph:
    - When sync flags are present, calls `scripts/db/sync-api-and-migrations.ps1|.sh`.
      - That script invokes `scripts/db/update-api-schema.ps1|.sh` to regenerate `Backend/openapi.json` and `Frontend/src/api-types.ts`.
      - Afterwards it runs `scripts/db/check-migration-drift.ps1|.sh`, which shells into `scripts/db/check_migration_drift.py` to autogenerate and (if needed) adopt migrations via Alembic.
    - When e2e flags are present, calls `scripts/tests/run-e2e-tests.ps1|.sh`.
    - Always sources `scripts/lib/venv.ps1|.sh` to ensure the virtual environment is active.

- `scripts/tests/run-e2e-tests.ps1` / `scripts/tests/run-e2e-tests.sh`
  - Purpose: spin up a branch-isolated Docker Compose test stack, wait for the backend to become healthy, then execute `pytest -m e2e` against `Backend/tests/test_e2e_api.py`.
  - Flags: accepts additional pytest arguments (pass-through). Both variants honour `-h|--help`.
  - Call graph: loads helpers from `scripts/lib/venv.*`, `scripts/lib/branch-env.*`, and `scripts/lib/compose-utils.*`; always shells into `scripts/docker/compose.ps1|.sh` (`up ...` to start, `down ...` to tear down).

### Docker stack management

- `scripts/docker/compose.ps1` / `scripts/docker/compose.sh`
  - Purpose: orchestrate Docker Compose stacks with branch-specific project names, port offsets, and data seed flows.
  - Subcommands (common to both shells):
    - `up [type <-dev|-test>] data <-test|-prod> [service...]`
    - `down [type <-dev|-test>]`
    - `restart [type <-dev|-test>] data <-test|-prod>`
  - Behavior:
    - `type -test` remaps the dev ports/volumes to the dedicated `TEST_*` values for isolated stacks.
    - `data -prod` seeds production fixtures. PowerShell restores the latest branch backup via `scripts/db/restore.ps1 -UpgradeAfter`; Bash seeds CSV fixtures via `Database/import_from_csv.py --production`.
    - Writes resolved ports to `$COMPOSE_ENV_FILE` when present so callers (for example the e2e runner) can source them.
    - Ensures migrations run and seed data loads after startup, and provides graceful teardown including volume cleanup.
  - Call graph: loads `scripts/lib/branch-env.*`, `scripts/lib/worktree.sh` (Bash variant), and `scripts/lib/compose-utils.*`; PowerShell also imports `scripts/env/activate-venv.ps1` when applying test data.

### Environment and worktree helpers

- `scripts/env/activate-venv.ps1` / `scripts/env/activate-venv.sh`
  - Purpose: create/activate `.venv`, install Python requirements, and keep `Frontend/node_modules` in sync with `package-lock.json`.
  - Flags: none; respects environment overrides `VENV_PATH`, `REQUIREMENTS_PATH`, and `FRONTEND_PATH`.

- `scripts/env/check.ps1` / `scripts/env/check.sh`
  - Purpose: verify the current directory is the correct worktree for the branch, ensure the default branch stays in the primary clone, and confirm the correct virtual environment is active.
  - Flags:
    - PowerShell: `-Fix`, `-Quiet`.
    - Bash: `--fix`.
  - Call graph: relies on `scripts/lib/branch-env.*` and `scripts/lib/worktree.sh`; PowerShell version can invoke `scripts/env/activate-venv.ps1` during fixes.

- `scripts/switch-worktree-branch.ps1`
  - Purpose: interactively pick a branch, jump to its dedicated worktree (creating it if needed), optionally open VS Code, optionally start Docker Compose, and always activate the virtualenv.
  - Flags/parameters: `-Branch`, `-Remote`, `-SkipVSCode`, `-NewVSCodeWindow`, `-StartWorkspaceStack`, and `-Data <test|prod>` (required with `-StartWorkspaceStack`).
  - Call graph: invokes `scripts/env/activate-venv.ps1` and `scripts/docker/compose.ps1` when the corresponding switches are selected.

### Repository maintenance

- `scripts/repo/check.ps1` / `scripts/repo/check.sh`
  - Purpose: one-stop repository hygiene command; optionally skip stages.
  - Flags:
    - PowerShell: `-SkipSync`, `-SkipAudit`, `-SkipContainers` plus pass-through `-SyncArgs` for nested branch sync options.
    - Bash: `--skip-sync`, `--skip-audit`, `--skip-containers` and `--` to forward arguments to branch sync.
  - Call graph:
    - Runs `scripts/repo/sync-branches.ps1|.sh` unless skipped.
      - PowerShell flags: `-NoFetch`, `-YesToAll`, `-DryRun`.
      - Bash flags: `--no-fetch`, `--yes`, `--dry-run`, `-h|--help`.
    - Runs `scripts/repo/audit-worktrees.ps1|.sh` (no flags) to validate branch↔worktree mappings and naming conventions; prompts before removing orphans.
    - Runs `scripts/repo/audit-container-sets.ps1|.sh` (no flags, honours `$CONTAINER_SET_PREFIX`) to locate Compose stacks without matching branches; prompts before removal and exits non-zero if unresolved stacks remain.

### Database management

- `scripts/db/backup.ps1` / `scripts/db/backup.sh`
  - Purpose: capture a branch-local Postgres dump and write companion metadata.
  - Flags: none.
  - Call graph: loads `scripts/lib/branch-env.*` and `scripts/lib/compose-utils.*`; PowerShell variant falls back to running pg_dump inside the container when the host CLI is unavailable.

- `scripts/db/restore.ps1` / `scripts/db/restore.sh`
  - Purpose: restore a custom-format dump into the branch-local database and optionally upgrade afterward.
  - Flags:
    - PowerShell: `-UpgradeAfter`, `-FailOnMismatch`, `-ResetSchema`, optional positional `DumpPath`.
    - Bash: `--upgrade-after`, `--fail-on-mismatch`, `--reset-schema`, optional dump file argument, `-h|--help`.
  - Behavior: auto-selects the newest dump for the current branch (falling back to `main` when necessary), refuses to touch non-localhost databases, can drop/recreate the `public` schema, and compares backup Alembic revision metadata against repo heads.

- `scripts/db/import-from-csv.ps1` / `scripts/db/import-from-csv.sh`
  - Purpose: load CSV fixtures into the running branch database.
  - Flags: exactly one of `-production`/`--production` or `-test`/`--test`.
  - Call graph: ensures venv activation and running containers before executing `python Database/import_from_csv.py` with the matching flag.

- `scripts/db/export-to-csv.ps1` / `scripts/db/export-to-csv.sh`
  - Purpose: export tables from the branch database into CSV fixtures.
  - Flags: choose data set with `-Production`/`--production` or `-Test`/`--test` (default is production) and optionally specify `-OutputDir`/`--output-dir <path>`.
  - Behavior: resolves output directories to absolute paths when possible and runs `python Database/export_to_csv.py` with the assembled arguments.

- `scripts/db/update-api-schema.ps1` / `scripts/db/update-api-schema.sh`
  - Purpose: launch the FastAPI app with Uvicorn, fetch `openapi.json`, and regenerate frontend TypeScript types via `openapi-typescript`.
  - Flags: none.
  - Call graph: both variants source `scripts/lib/venv.*` and `scripts/lib/python.*`; PowerShell version additionally leverages `scripts/lib/log.ps1` for status output.

- `scripts/db/sync-api-and-migrations.ps1` / `scripts/db/sync-api-and-migrations.sh`
  - Purpose: unify API schema updates with migration drift detection.
  - Flags: PowerShell uses `-Auto` (alias `-y`); Bash accepts `-y` or `CI=true` to auto-confirm prompts.
  - Call graph: ensures the virtual environment is active, runs `update-api-schema`, then `check-migration-drift`, and summarises whether migrations were adopted.

- `scripts/db/check-migration-drift.ps1` / `scripts/db/check-migration-drift.sh`
  - Purpose: execute `scripts/db/check_migration_drift.py`, which spins up a disposable Postgres container, autogenerates a migration to detect drift, and optionally adopts it.
  - Flags: pass-through arguments to the Python script (currently none).

- `scripts/db/check_migration_drift.py`
  - Purpose: shared core for drift detection; returns exit code `0` when clean or after successful adoption, `2` when drift persists after adoption, `1` on failure.
  - Behavior: cleans temporary revisions, starts a Postgres container on `TEST_DB_PORT` (or random port), runs Alembic autogenerate twice, renames adopted files with a timestamp slug, and removes temporary containers/files.

### Shared libraries

The `scripts/lib/` directory contains reusable helpers that other scripts source:

- `branch-env.ps1` / `branch-env.sh`: compute sanitized branch names, Compose project identifiers, and branch-specific port offsets.
- `compose-utils.ps1` / `compose-utils.sh`: inspect Compose stacks, ensure branch containers are running, and expose the dedicated test project name.
- `worktree.sh`: enforce the worktree naming convention (used by Bash scripts such as the Compose wrapper and environment checks).
- `venv.ps1` / `venv.sh`: activate the per-worktree virtualenv, bootstrapping dependencies as required.
- `python.ps1` / `python.sh`: resolve the appropriate Python interpreter/arguments.
- `log.ps1`: provide consistent status output helpers for PowerShell scripts.

Refer back to this section whenever you touch a script—any new flag, behavior change, or entry point must be reflected here.

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

## Fridge Workflow Notes

- Domain logic around stored foods now validates macro values on both the FastAPI schemas and database constraints. When you
  touch the fridge routes or models, update the corresponding tests under `Backend/tests/test_stored_food.py` and
  `Backend/tests/test_logs.py` so over-consumption and negative macro scenarios stay covered.
- The Cooking and Food Logging panes share a `FeedbackSnackbar` component to surface success and error toasts. Reuse that helper
  when adding new fridge interactions so the UX remains consistent.

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
