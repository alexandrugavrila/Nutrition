# Agent Instructions

## Project overview
This repository contains a full-stack nutrition planning and tracking application.
- **Frontend:** React with Material UI.
- **Backend:** FastAPI with SQLModel.
- **Database:** PostgreSQL, seeded via scripts in `Database/`.
- **Containerization:** Docker and docker-compose for running services.

---

## Docker environment
- Develop inside branch-specific Docker Compose stacks.
- Launch with `./scripts/docker/compose.sh up data -test` (or `.ps1`); stop with `./scripts/docker/compose.sh down`.
- Containers and ports are isolated per branch, enabling parallel stacks.
- Port offsets per branch (N from branch hash): DB 5432+N, Backend 8000+N, Frontend 3000+N.
- Optional: add `type -test` to run a dedicated test stack on TEST ports (used by e2e scripts). Without `type`, it defaults to dev ports.

---

## Build and test commands
- Install backend dependencies: `pip install -r Backend/requirements.txt`
- Install frontend dependencies: `npm --prefix Frontend install`
- Run backend development server: `uvicorn Backend.backend:app --reload`
- Start frontend development server: `npm --prefix Frontend run dev`
- Run backend unit tests: `pytest` (uses SQLite)
- Run frontend tests: `npm --prefix Frontend test`
- Run end-to-end API tests: `pwsh ./scripts/tests/run-e2e-tests.ps1` or `./scripts/tests/run-e2e-tests.sh` (spins up a dedicated test stack and tears it down)

---

## Code style guidelines
- **Python:** Follow [PEP 8](https://peps.python.org/pep-0008/). Format code with `black` and organize imports with `isort`.
- **JavaScript/TypeScript:** Use `eslint` and `prettier` with the configurations in the project. Prefer functional components and hooks in React code.
- Write descriptive commit messages and keep functions small and focused.

---

## Documentation maintenance

We use a **split-responsibility model** between `README.md` and `CONTRIBUTING.md`:

- **README.md**
  - Audience: new developers, evaluators, or visitors to the repo.
  - Should contain:
    - Project overview (what the app is, technologies used)
    - Quick start (clone → start services → access frontend/backend)
    - Project structure
    - Core concepts
    - API highlights
    - Diagrams
    - A short link to CONTRIBUTING for deeper details
  - **Avoid duplication** of migration, OpenAPI, or CI/CD workflows — link to CONTRIBUTING instead.

- **CONTRIBUTING.md**
  - Audience: active contributors.
  - Should contain:
    - Virtual environment setup
    - Branching conventions
    - Docker workflows and port mapping
    - API & migrations handling (via `scripts/db/sync-api-and-migrations.ps1` as the canonical workflow)
    - Manual fallback commands (Alembic, update-api-schema, drift check)
    - Tools (DBeaver, etc.)
    - Typical commit checklist
    - CI/CD workflow explanation
    - Troubleshooting
  - Keep this as the **single source of truth** for contributor workflows.

**Maintenance rules:**
- If a section in README starts to grow too detailed, **move it to CONTRIBUTING**.
- If both files mention the same topic, README should stay **high-level** and point to CONTRIBUTING for details.
- After modifying scripts or workflows, always:
  1. Update `CONTRIBUTING.md` with details.  
  2. Update `README.md` only if the **developer-facing experience changes** (e.g., new quick-start steps).

---

## Script parity checks
- Scripts in the `scripts/` directory have both PowerShell (`.ps1`) and Bash (`.sh`) variants.
- When modifying or adding a script, update and verify both versions to keep them in sync.

---

## Testing instructions
- Ensure both backend and frontend tests pass before committing:
  - `pytest`
  - `CI=true npm --prefix Frontend test`
- Add tests for any new features or bug fixes.

---

## Security considerations
- Never commit secrets or credentials. Use environment variables for sensitive data.
- Validate and sanitize all user inputs on both client and server.
- Keep dependencies updated and promptly address security advisories.
- Restrict network and database permissions to the minimum necessary.
