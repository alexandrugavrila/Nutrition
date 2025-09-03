# 🍽️ Nutrition Tracker

A full-stack nutrition planning and tracking app built with:

- 🖥️ **React** frontend (Material UI + Context API)
- 🐍 **FastAPI** backend (SQLModel)
- 🐘 **PostgreSQL** database (seeded with food and nutrition data)
- 🐳 **Docker** for development and deployment

---

## 🚀 Quick Start

### 1. Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [PowerShell 7+](https://learn.microsoft.com/powershell/) (Windows/macOS/Linux)
- [DBeaver](https://dbeaver.io/download/) (optional, DB GUI)

### 2. Clone & Launch

```pwsh
git clone https://github.com/alexandrugavrila/Nutrition
cd Nutrition

# Start stack for this branch (dev ports)
pwsh ./scripts/docker/compose.ps1 up data -test   # or data -prod
```

👉 The script prints the branch-specific ports for frontend, backend, and database.
Multiple branches can run in parallel without conflicts.

### 3. Access Services

- Frontend → `http://localhost:<DEV_FRONTEND_PORT>`
- Backend API → `http://localhost:<DEV_BACKEND_PORT>`
- PostgreSQL → `localhost:<DEV_DB_PORT>`

### 4. Environment Variables

The frontend dev server proxies `/api` requests to the backend. By default it targets the branch-specific port printed above. Set `BACKEND_URL` to point at a different backend host.

### 5. Frontend Commands

Run the React app directly without Docker:

```bash
npm --prefix Frontend run dev     # start dev server
npm --prefix Frontend run build   # production build
npm --prefix Frontend run preview # preview build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full contributor workflow details.

### 6. Database Migrations (local)

When running Alembic locally (outside Docker), point it at the backend config:

```bash
alembic -c Backend/alembic.ini upgrade head
```

This ensures Alembic finds the migration scripts under `Backend/migrations/`.

### 7. Run Tests

```bash
./scripts/run-tests.sh        # Bash
pwsh ./scripts/run-tests.ps1  # PowerShell
```

Pass `--e2e` to also run the end-to-end API suite. The e2e runner stands up a dedicated test stack (on TEST ports) and tears it down after tests.

### 8. Database Backups

```bash
./scripts/db/backup.sh        # Bash
pwsh ./scripts/db/backup.ps1  # PowerShell
```

Backups are written to `Database/backups/` with timestamped filenames.

Restore the most recent dump for the current branch:

```bash
./scripts/db/restore.sh
pwsh ./scripts/db/restore.ps1
```

Or restore a specific file:

```bash
./scripts/db/restore.sh Database/backups/<file>
pwsh ./scripts/db/restore.ps1 Database/backups/<file>
```

If your local schema has drifted and restore fails with dependency errors, reset the schema first:

```bash
./scripts/db/restore.sh --reset-schema
pwsh ./scripts/db/restore.ps1 -ResetSchema
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 🗂️ Project Structure

```
Nutrition/
├── Backend/        # FastAPI app (models, routes, db)
├── Frontend/       # React app
├── Database/       # CSV seed data + import utils
├── docker-compose.yml
└── scripts/        # Helper scripts
    ├── docker/     # Compose up/down and stack management
    ├── db/         # Database and API schema utilities
    ├── env/        # Virtualenv setup helpers
    └── tests/      # Test runners and helpers
```

---

## 🧠 Core Concepts

- **Backend** → API routes in `Backend/routes/`, models in `Backend/models/`
- **Frontend** → React app in `Frontend/`, global `DataContext.js` for state
- **Database** → Schema managed with Alembic migrations, optional CSV seed data

---

## ✅ API Endpoints

**Ingredients**

- `GET /ingredients` – list all
- `GET /ingredients/{id}` – single ingredient
- `GET /ingredients/possible_tags` – list tags
- `POST /ingredients` – add new
- `PUT /ingredients/{id}` – update
- `DELETE /ingredients/{id}` – remove

Each ingredient persists a base unit named `g` with `grams == 1`.

**Foods**

- `GET /foods` – list all
- `GET /foods/{id}` – single food
- `GET /foods/possible_tags` – list tags
- `POST /foods` – add new
- `PUT /foods/{id}` – update
- `DELETE /foods/{id}` – remove

---

## 📊 Diagrams

<details>
<summary>Backend Schema (Mermaid)</summary>

```mermaid
erDiagram
  INGREDIENT ||--o{ INGREDIENT_UNIT : has
  INGREDIENT ||--|| NUTRITION : contains
  INGREDIENT ||--o{ INGREDIENT_TAG : tagged_with
  INGREDIENT_TAG }o--|| POSSIBLE_INGREDIENT_TAG : references
  FOOD ||--o{ FOOD_INGREDIENT : includes
  FOOD_INGREDIENT }o--|| INGREDIENT : uses
  FOOD ||--o{ FOOD_TAG : tagged_with
  FOOD_TAG }o--|| POSSIBLE_FOOD_TAG : references
```

</details>

<details>
<summary>Frontend Structures (Mermaid)</summary>

```mermaid
classDiagram
  class Ingredient { id; name; Nutrition nutrition; IngredientUnit[] units }
  class Food { id; name; FoodIngredient[] ingredients; FoodTag[] tags }
```

</details>

---

## 🤝 Contributing

For **developer setup, migrations, OpenAPI generation, commit checklist, and CI/CD details**, see
👉 [CONTRIBUTING.md](CONTRIBUTING.md)
