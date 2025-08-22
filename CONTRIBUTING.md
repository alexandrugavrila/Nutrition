# 🤝 Contributing Guide

This guide covers **developer setup, branch conventions, database management, and local dev workflows**.
The [README](README.md) has the high-level overview and quick start.

---

## Virtual environment

All development tasks should be run from inside the project's Python virtual environment. The helper script will create and activate it and install dependencies as needed:

```powershell
pwsh ./scripts/activate-venv.ps1
```

## 🔀 Branching

* Use the format:

  ```
  [type]/issue-in-kabob-case
  ```
* Types: `feature`, `refactor`, `bugfix`, `housekeeping`

---

## 🐳 Docker Workflows

### Rebuilding containers

Always use the helper script for your branch (not raw `docker compose`):

```pwsh
pwsh ./scripts/compose-up-branch.ps1 -test        # or -production / -empty
```

This ensures:

* Correct **per-branch project name**
* Correct **branch-specific ports**
* Optional CSV import (`-production` / `-test`), or skip with `-empty`

---

### Stopping containers

Clean up branch containers safely with:

```pwsh
pwsh ./scripts/compose-down-branch.ps1
```

Options:

* `-Force` → skip confirmation
* `-PruneImages` → also remove built images
* Volumes are removed by default (`-v`) so each branch starts fresh

---

## ⚙️ Port Mapping

Each branch gets **unique host ports**, calculated as:

* Base ports → Frontend `3000`, Backend `8000`, DB `5432`
* Plus branch-specific offset (hash of branch name)

The startup script prints exact values.

### Example

| Branch      | Frontend | Backend | DB   |
| ----------- | -------- | ------- | ---- |
| `main`      | 3000     | 8000    | 5432 |
| `feature/x` | 3004     | 8006    | 5438 |
| `bugfix/y`  | 3012     | 8012    | 5444 |

In Docker Desktop, ports show as `HOST:CONTAINER` (e.g. `3099:3000`).
Click the **host port** (3099) to open the frontend in your browser.

---

## 🗄️ Database Management

### Seeding and imports

On a fresh DB volume, Postgres runs the SQL files in `Database/`:

* `createtables.sql`
* `addingredients.sql`
* `addnutrition.sql`

In addition, the startup script may run:

* `import_from_csv.py --production` (with `-production`)
* `import_from_csv.py --test` (with `-test`)
* Skips import with `-empty`

---

### Resetting from scratch

Drop and recreate tables manually:

```bash
python ./Database/reset_database.py
```

Options:

```bash
python ./Database/reset_database.py --test
```

---

### DBeaver setup

[DBeaver](https://dbeaver.io/download/) is a free GUI for PostgreSQL.

1. **Install** Community Edition
2. **New Connection** → PostgreSQL
3. Enter:

| Field    | Value            |
| -------- | ---------------- |
| Host     | `localhost`      |
| Port     | `<DB_PORT>`      |
| Database | `nutrition`      |
| Username | `nutrition_user` |
| Password | `nutrition_pass` |

👉 `<DB_PORT>` = base 5432 + branch offset (printed on startup).
In Docker Desktop, shown as `PORT:5432`.

---

## 💻 Local Development (Non-Docker)

You can also run backend/frontend directly on your machine.

### Backend (FastAPI)

Virtual Environment Setup
```powershell
pwsh ./scripts/activate-venv.ps1
```

# Run backend
uvicorn Backend.backend:app --reload
```

### Frontend (React)

```bash
cd Frontend/nutrition-frontend
npm install
npm start
```

---

## 🧩 Project Structure (Developer View)

```
Backend/                  # FastAPI app
  ├── db_models/          # SQLAlchemy ORM models
  ├── models/             # Pydantic models
  ├── routes/             # API routes
  ├── backend.py          # Entrypoint
  └── db.py               # SQLAlchemy setup

Frontend/nutrition-frontend/
  ├── src/                # React components, context
  ├── Dockerfile          # Frontend build config
  └── nginx.conf          # Static serving config

Database/                 # SQL + CSV seeding
scripts/                  # Helper scripts (compose up/down, tooling)
```

---

## 📚 Reference

* **Frontend ports** → base `3000` + offset
* **Backend ports** → base `8000` + offset
* **DB ports** → base `5432` + offset
* **Credentials** → `nutrition_user` / `nutrition_pass` / `nutrition`

---