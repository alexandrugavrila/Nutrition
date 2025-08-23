# 🍽️ Nutrition Tracker

A full-stack nutrition planning and tracking app built with:

* 🖥️ **React** frontend (Material UI + Context API)
* 🐍 **FastAPI** backend (SQLModel)
* 🐘 **PostgreSQL** database (seeded with food and nutrition data)
* 🐳 **Docker** for development and deployment

---

## 🚀 Quick Start

### 1. Install prerequisites

* [Docker Desktop](https://www.docker.com/products/docker-desktop) (✅ check “Add to PATH” during install)
* [DBeaver Community](https://dbeaver.io/download/) (for exploring the database, optional)
* [PowerShell 7+](https://learn.microsoft.com/powershell/) (Windows/macOS/Linux)

### 2. Clone & launch

```pwsh
# Clone the repository
git clone https://github.com/alexandrugavrila/Nutrition
cd Nutrition

# Start all services for the current branch
# Pick ONE: -production | -test | -empty
pwsh ./scripts/compose-up-branch.ps1 -test
```

👉 On startup, the script prints the **branch-specific ports** for the frontend, backend, and database.
Multiple branches can run in parallel without conflict.

### 3. Access services

* Frontend: [http://localhost:\<FRONTEND\_PORT>](http://localhost:3000)
* Backend API: [http://localhost:\<BACKEND\_PORT>](http://localhost:8000)
* PostgreSQL: `localhost:<DB_PORT>`

## 🐍 Virtual Environment

All development should be run from inside the project's Python virtual environment. Use the helper script to create and activate it:

```powershell
pwsh ./scripts/activate-venv.ps1
```

The script creates the `.venv` directory if needed and installs or updates
dependencies. It caches a hash of `Backend/requirements.txt` inside the virtual
environment and automatically reruns `pip install` whenever that file changes.

## ▶️ Run the Backend

Start the FastAPI application locally with [uvicorn](https://www.uvicorn.org/):

```bash
uvicorn Backend.backend:app --reload
```

The server will be available at <http://localhost:8000> by default.

---


## 🛠️ Running Migrations

> **Note:** SQLModel models are the source of truth. Database migrations and the OpenAPI
> schema are generated from these models. After modifying models, run `alembic revision --autogenerate`
> and `scripts/update-api-schema.sh`, then commit the new migration, `Backend/openapi.json`, and
> `Frontend/nutrition-frontend/src/api-types.ts`.

The backend uses [Alembic](https://alembic.sqlalchemy.org/) for schema changes.
Run these commands from the repository root:

```bash
# create a new migration after updating models
alembic revision --autogenerate -m "describe your change"

# apply all pending migrations
alembic upgrade head

# reset the database (drops all tables and reapplies migrations)
alembic downgrade base && alembic upgrade head
```

To load sample data from the CSV files in `Database/`, run:

```bash
python Database/import_from_csv.py --test   # or --production
```

### Troubleshooting
* "No changes detected" – ensure new models are imported in `alembic/env.py`.
* Migration fails to apply – verify the database URL matches your running service.
* Stuck in a bad state – reset with `alembic downgrade base && alembic upgrade head`.

## 📚 Generating OpenAPI

Use `scripts/update-api-schema.sh` as the single source of truth for generating
`Backend/openapi.json` and syncing frontend TypeScript types. The script spins
up a temporary FastAPI server, fetches `/openapi.json`, and runs
[`openapi-typescript`](https://github.com/drwpow/openapi-typescript). Set the
port with `BACKEND_PORT` (defaults to `8000`) and run:

```bash
npm --prefix Frontend/nutrition-frontend install   # run once
export BACKEND_PORT=8000  # optional
scripts/update-api-schema.sh
```

Run this script whenever API models change and commit the generated files.

### Advanced: Manual workflow

If you need to generate the schema manually:

```bash
uvicorn Backend.backend:app --port 8000 &
curl http://localhost:8000/openapi.json -o Backend/openapi.json
kill %1
```

### Troubleshooting
* `openapi-typescript` not found – ensure frontend dev dependencies are installed.
* Generated types missing endpoints – ensure migrations were applied and rerun the script.
* 404 on `/openapi.json` – confirm the backend server started and you're hitting the correct port.

## 🚦 CI/CD Expectations

* PRs that modify backend models must include an Alembic migration.
* API changes require an updated `Backend/openapi.json` and synced frontend types.
* All tests (`pytest` and `npm test`) should pass before merging.

---

## 🗂️ Project Structure

```
Nutrition/
├── Backend/                     # FastAPI app
│   ├── models/                 # SQLModel models
│   ├── routes/                 # Ingredient and meal routes
│   ├── backend.py              # FastAPI entrypoint
│   ├── db.py                   # SQLModel setup
│   └── Dockerfile              # Backend build config
│
├── Frontend/
│   └── nutrition-frontend/     # React app
│       ├── src/                # App components, context, etc.
│       ├── Dockerfile          # Frontend build config
│       └── nginx.conf          # Nginx static serving config
│
├── Database/                   # CSV data + import utilities
│   ├── production_data/
│   ├── test_data/
│   └── import_from_csv.py
│
├── docker-compose.yml          # Orchestration config
└── scripts/
    ├── compose-up-branch.ps1   # Start stack with branch-specific ports
    ├── compose-down-branch.ps1
    ├── import-from-csv.sh
    └── activate-venv.ps1       # Create and activate the venv
```

---

## 🧠 Core Concepts

* **Backend**

  * API routes in `Backend/routes/`
  * SQLModel models in `Backend/models/`

* **Frontend**

  * Built in `Frontend/nutrition-frontend/`
  * Uses global `DataContext.js` to fetch and manage meals, ingredients, and tags

* **Database**

  * Schema managed via Alembic migrations
  * Optional CSV seed data in `Database/` (use `import_from_csv.py`)

---

## 📖 More for Contributors

* Branch naming conventions
* Port offset system (per-branch)
* Database reset/import scripts
* Local (non-Docker) dev setup

👉 See [CONTRIBUTING.md](CONTRIBUTING.md) for full developer setup and workflows.

---

## ✅ API Endpoints (Highlights)

### Ingredients

* `GET /ingredients` – all ingredients
* `POST /ingredients` – add ingredient
* `PUT /ingredients/<id>` – update ingredient
* `DELETE /ingredients/<id>` – delete ingredient
* `GET /ingredients/possible_tags` – list possible ingredient tags

### Meals

* `GET /meals` – all meals
* `GET /meals/<id>` – single meal
* `GET /meals/possible_tags` – list possible meal tags
  ⚠️ Meal `POST/PUT/DELETE` endpoints are currently commented out

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
  MEAL ||--o{ MEAL_INGREDIENT : includes
  MEAL_INGREDIENT }o--|| INGREDIENT : uses
  MEAL ||--o{ MEAL_TAG : tagged_with
  MEAL_TAG }o--|| POSSIBLE_MEAL_TAG : references
```

</details>

<details>
<summary>Frontend Structures (Mermaid)</summary>

```mermaid
classDiagram
  class Ingredient { id; name; Nutrition nutrition; IngredientUnit[] units }
  class Meal { id; name; MealIngredient[] ingredients; MealTag[] tags }
```

</details>

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for full developer setup, scripts, and workflows.

---