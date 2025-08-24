# Agent Instructions

## Project overview
This repository contains a full-stack nutrition planning and tracking application.
- **Frontend:** React with Material UI.
- **Backend:** FastAPI with SQLModel.
- **Database:** PostgreSQL, seeded via scripts in `Database/`.
- **Containerization:** Docker and docker-compose for running services.

## Build and test commands
- Install backend dependencies: `pip install -r Backend/requirements.txt`
- Install frontend dependencies: `npm --prefix Frontend install`
- Run backend development server: `uvicorn Backend.backend:app --reload`
- Start frontend development server: `npm --prefix Frontend start`
- Run backend tests: `pytest`
- Run frontend tests: `npm --prefix Frontend test`

## Code style guidelines
- **Python:** Follow [PEP 8](https://peps.python.org/pep-0008/). Format code with `black` and organize imports with `isort`.
- **JavaScript/TypeScript:** Use `eslint` and `prettier` with the configurations in the project. Prefer functional components and hooks in React code.
- Write descriptive commit messages and keep functions small and focused.

## Script parity checks
- Scripts in the `scripts/` directory have both PowerShell (`.ps1`) and Bash (`.sh`) variants.
- When modifying or adding a script, update and verify both versions to keep them in sync.

## Testing instructions
- Ensure both backend and frontend tests pass before committing:
  - `pytest`
  - `CI=true npm --prefix Frontend test`
- Add tests for any new features or bug fixes.

## Security considerations
- Never commit secrets or credentials. Use environment variables for sensitive data.
- Validate and sanitize all user inputs on both client and server.
- Keep dependencies updated and promptly address security advisories.
- Restrict network and database permissions to the minimum necessary.
