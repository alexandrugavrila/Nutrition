# 🍽️ Nutrition Tracker

A full-stack nutrition planning and tracking app built with:

- 🖥️ **React** frontend (using Context and Material UI)
- 🐍 **Flask** backend (with SQLAlchemy)
- 🐘 **PostgreSQL** database (seeded with food and nutrition data)
- 🐳 Docker for development and deployment

---

## 🚀 Quick Start (Docker)

```bash
# Clone the repository
git clone <your-repo-url>
cd Nutrition

# Start all services for the current Git branch
# Choose one of -production, -test, or -empty to control database seeding
pwsh ./scripts/compose-up-branch.ps1 -test --build

# When you're done, remove containers and volumes for this branch
BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '[:upper:]' '[:lower:]' | sed 's#[^a-z0-9]#-#g')
docker compose -p nutrition-$BRANCH down -v
```

* Frontend: `http://localhost:<FRONTEND_PORT>` (prints on startup, default 3000)
* Backend API: `http://localhost:<BACKEND_PORT>` (default 5000)
* PostgreSQL: `localhost:<DB_PORT>` (default 5432)

> 📝 The database is seeded automatically on first run using `Database/createtables.sql`, `addingredients.sql`, and `addnutrition.sql`.

---

## 🗂️ Project Structure

```
Nutrition/
├── Backend/                     # Flask app
│   ├── db_models/              # SQLAlchemy ORM models
│   ├── schemas/                # Marshmallow schemas
│   ├── routes/                 # Ingredient and meal routes
│   ├── backend.py              # Main Flask entrypoint
│   ├── db.py                   # SQLAlchemy setup
│   └── Dockerfile              # Backend build config
│
├── Frontend/                   # React app
│   ├── src/                # App components, context, etc.
│   ├── Dockerfile          # Frontend build config
│   └── nginx.conf          # Nginx static serving config
│
├── Database/                   # SQL seed scripts
│   ├── createtables.sql
│   ├── addingredients.sql
│   └── addnutrition.sql
│
├── docker-compose.yml          # Orchestration config
└── scripts/
    ├── compose-up-branch.ps1   # Start stack with branch-specific ports
    └── print-tree.ps1          # Dev tooling
```

---

## ⚙️ Environment and Configuration

| Service    | Base Port | Description                                   |
| ---------- | ---------- | ---------------------------------------------- |
| Frontend   | 3000       | React app served via Nginx (offset per branch) |
| Backend    | 5000       | Flask API (offset per branch)                  |
| PostgreSQL | 5432       | Nutrition DB with initial data (offset per branch) |

Environment variables are defined in `docker-compose.yml`:

```yaml
POSTGRES_USER: nutrition_user
POSTGRES_PASSWORD: nutrition_pass
POSTGRES_DB: nutrition
```

Backend connects using:

```
postgresql://nutrition_user:nutrition_pass@db:5432/nutrition
```

---

### 🛠️ Database access

For detailed instructions on connecting to the development database with DBeaver, see the [Database access section](CONTRIBUTING.md#database-access) in the contributing guide.

---

## 🧠 Core Concepts

### Backend (Flask)

* All API routes are defined under `Backend/routes/`
* SQLAlchemy models under `db_models/` are serialized and validated using Marshmallow schemas in `schemas/`
* Main routes:

  * `GET /ingredients`
  * `POST /ingredients`
  * `PUT /ingredients/<id>`
  * `DELETE /ingredients/<id>`
  * `GET /ingredients/possible_tags`
  * (same for `/meals`, not shown here)

### Frontend (React)

* Built in `Frontend`
* `App.js` renders:

  * `<MealData />`
  * `<IngredientData />`
* Data is managed globally via `DataContext.js`

  * Automatically fetches:

    * All ingredients and meals
    * All possible tags
  * Categorizes tags into `group`, `processing`, `type`, and `diet`
  * Tag filtering components accept `{ group: "Category", ...tag }` objects to
    show grouped options via MUI's Autocomplete

---

## 🤝 Contributing

Developer setup and contribution guidelines are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## ✅ API Endpoints

### 🥕 **Ingredients**

| Method | Endpoint                     | Description                              |
| ------ | ---------------------------- | ---------------------------------------- |
| GET    | `/ingredients`               | Get all ingredients                      |
| GET    | `/ingredients/<id>`          | Get a specific ingredient by ID          |
| POST   | `/ingredients`               | Add a new ingredient                     |
| PUT    | `/ingredients/<id>`          | Update an existing ingredient            |
| DELETE | `/ingredients/<id>`          | Delete an ingredient                     |
| GET    | `/ingredients/possible_tags` | Get list of all possible ingredient tags |

---

### 🍽️ **Meals**

| Method | Endpoint               | Description                        |
| ------ | ---------------------- | ---------------------------------- |
| GET    | `/meals`               | Get all meals                      |
| GET    | `/meals/<id>`          | Get a specific meal by ID          |
| GET    | `/meals/possible_tags` | Get list of all possible meal tags |

---

### 🚧 **Commented Out / Incomplete Endpoints**

The following endpoints are defined but **commented out** in your `routes/meals.py`. They appear to be part of CRUD functionality for meals but are currently non-functional:

| Method | Endpoint      | Description             |
| ------ | ------------- | ----------------------- |
| POST   | `/meals`      | Add a new meal          |
| PUT    | `/meals/<id>` | Update an existing meal |
| DELETE | `/meals/<id>` | Delete a meal           |

---

## 🎨 Backend Mermaid Diagram

<details>
<summary>📊 Click to expand Backend Mermaid diagram</summary>

```mermaid
erDiagram

  INGREDIENT ||--o{ INGREDIENT_UNIT : has
  INGREDIENT ||--|| NUTRITION : contains
  INGREDIENT ||--o{ INGREDIENT_TAG : tagged_with
  INGREDIENT_TAG }o--|| POSSIBLE_INGREDIENT_TAG : references

  MEAL ||--o{ MEAL_INGREDIENT : includes
  MEAL_INGREDIENT }o--|| INGREDIENT : uses
  MEAL_INGREDIENT }o--|| INGREDIENT_UNIT : in_unit

  MEAL ||--o{ MEAL_TAG : tagged_with
  MEAL_TAG }o--|| POSSIBLE_MEAL_TAG : references

  INGREDIENT {
    int id PK
    string name
  }

  NUTRITION {
    int ingredient_id PK, FK
    float calories
    float protein
    float fat
    float carbohydrates
    float fiber
  }

  INGREDIENT_UNIT {
    int id PK
    int ingredient_id FK
    string name
    float grams
  }

  POSSIBLE_INGREDIENT_TAG {
    int id PK
    string tag
  }

  INGREDIENT_TAG {
    int id PK
    int ingredient_id FK
    int tag_id FK
  }

  MEAL {
    int id PK
    string name
  }

  MEAL_INGREDIENT {
    int meal_id PK, FK
    int ingredient_id FK
    int unit_id FK
    float unit_quantity
  }

  POSSIBLE_MEAL_TAG {
    int id PK
    string tag
  }

  MEAL_TAG {
    int id PK
    int meal_id FK
    int tag_id FK
  }
```

</details>



---

### 🧩 Frontend Data Structures (JavaScript)

<details>
<summary>📊 Click to expand Frontend Mermaid diagram</summary>

```mermaid
classDiagram
  class Ingredient {
    int id
    string name
    Nutrition nutrition
    IngredientUnit[] units
    IngredientTag[] tags
    int selectedUnitId
  }

  class IngredientUnit {
    int id
    int ingredient_id
    string name
    float grams
  }

  class Nutrition {
    float calories
    float protein
    float carbohydrates
    float fat
    float fiber
  }

  class IngredientTag {
    int id
    string name
  }

  class Meal {
    int id
    string name
    MealIngredient[] ingredients
    MealTag[] tags
  }

  class MealIngredient {
    int ingredient_id
    int meal_id
    int unit_id
    float amount
  }

  class MealTag {
    int id
    string name
  }

  Ingredient o-- Nutrition
  Ingredient o-- IngredientUnit
  Ingredient o-- IngredientTag
  Meal o-- MealIngredient
  Meal o-- MealTag
```

</details>