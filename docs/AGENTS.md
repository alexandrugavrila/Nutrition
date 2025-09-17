# Agent Instructions

## Project overview
This repository contains a full-stack nutrition planning and tracking application.
- **Frontend:** React with Material UI (Vite dev server).
- **Backend:** FastAPI with SQLModel.
- **Database:** PostgreSQL, seeded via scripts in `Database/`.
- **Containerization:** Docker Compose managed by branch-aware helper scripts.

---

## Worktrees & Environment
- The default branch (`main`) must remain in the primary clone.
- Feature branches belong in sibling worktrees named `nutrition-<sanitized-branch>`.
- Before making changes, run `pwsh ./scripts/repo/check.ps1` (or `./scripts/repo/check.sh`) to fetch, prune, and audit worktrees.
- Use `pwsh ./scripts/switch-worktree-branch.ps1 <branch>` to create or jump to the correct worktree (PowerShell is available cross-platform).
- Verify the shell is in the correct worktree with an active virtualenv: `pwsh ./scripts/env/check.ps1 -Fix` or `./scripts/env/check.sh --fix`.
- Activate dependencies when needed via `pwsh ./scripts/env/activate-venv.ps1` or `source ./scripts/env/activate-venv.sh`.

---

## Docker environment
- Develop inside branch-specific Docker Compose stacks.
- Launch with `pwsh ./scripts/docker/compose.ps1 up data -test` (or `.ps1 data -prod`); stop with `pwsh ./scripts/docker/compose.ps1 down`.
- Add `type -test` to run on the dedicated test ports used by the e2e suite.
- Containers and ports are isolated per branch through the helper scripts, so multiple branches can run simultaneously.
- Startup waits for Postgres, applies Alembic migrations, and seeds data based on the selected mode.

---

## Build and test commands
- Backend dev server: `uvicorn Backend.backend:app --reload` (after activating the venv).
- Frontend dev server: `npm --prefix Frontend run dev` (the Vite proxy honors `DEV_BACKEND_PORT`).
- Combined test runner: `pwsh ./scripts/run-tests.ps1` (flags: `-sync`, `-e2e`, `-full`). Bash: `./scripts/run-tests.sh`.
- E2E tests only: `pwsh ./scripts/tests/run-e2e-tests.ps1` or `./scripts/tests/run-e2e-tests.sh` (uses test ports).
- API and migration sync: `pwsh ./scripts/db/sync-api-and-migrations.ps1`.

---

## Documentation maintenance

We use a split-responsibility model between `README.md` and `CONTRIBUTING.md`:

- **README.md**
  - Audience: new developers, evaluators, or visitors to the repo.
  - Should contain:
    - Project overview
    - Quick start (clone → worktree → environment → compose)
    - Project structure, core concepts, API highlights, diagrams
    - Pointer to CONTRIBUTING for full workflows
  - Avoid duplication of migration/OpenAPI/CI workflows; link to CONTRIBUTING instead.

- **CONTRIBUTING.md**
  - Audience: active contributors.
  - Should contain:
    - Virtual environment setup
    - Branching conventions and worktree workflow
    - Docker + port mapping details
    - API & migration handling (canonical: `scripts/db/sync-api-and-migrations.ps1`)
    - Manual fallback commands and troubleshooting
    - Testing strategy, commit checklist, CI/CD explainers
  - Keep this as the single source of truth for contributor workflows.

Maintenance rules:
- If a section in README grows too detailed, move detail to CONTRIBUTING and link back.
- README stays high-level; CONTRIBUTING holds the step-by-step instructions.
- After modifying scripts or workflows, update CONTRIBUTING first and README if the developer-facing experience changes.

---

## Script parity checks
- Scripts in `scripts/` have PowerShell (`.ps1`) and Bash (`.sh`) variants unless noted. Keep both variants in sync when editing.

---

## Testing instructions
- Ensure both backend and frontend tests pass before committing:
  - `pwsh ./scripts/run-tests.ps1 -full`
  - Add focused test commands as needed (`pytest`, `npm --prefix Frontend test`).
- Run `pwsh ./scripts/db/sync-api-and-migrations.ps1` whenever models or API routes change.

---

## Security considerations
- Never commit secrets or credentials; use environment variables for sensitive data.
- Validate and sanitize all user inputs on both client and server.
- Keep dependencies updated and address security advisories quickly.
- Restrict network and database permissions to the minimum necessary.
