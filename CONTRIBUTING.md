# Contributing

## Branch naming convention
type/issue-in-kabob-case

Types:
  Feature
  Refactor
  Bugfix
  Housekeeping

## Virtual environment

All development tasks should be run from inside the project's Python virtual environment. The helper script will create and activate it and install dependencies as needed:

```powershell
pwsh ./scripts/activate-venv.ps1
```

## Rebuilding Containers

To manually rebuild containers after a code change

```bash
docker-compose down -v
docker-compose up --build
```

Data will persist as long as you do not also delete the Docker volume

## Database management

The `import_from_csv.py` script will remove all existing data from the database
and import the specified data. Use the wrapper script so it targets the
containers for your current branch.

To import production data

```bash
./scripts/import-from-csv.sh -production
```

To import test data

```bash
./scripts/import-from-csv.sh -test
```

To drop and recreate the tables before importing:

```python
python .\\Database\\reset_database.py
```

To reset with test data:

```python
python .\\Database\\reset_database.py --test
```

## Local Development (non-Docker)

**Backend:**

Virtual Environment Setup
```powershell
pwsh ./scripts/activate-venv.ps1
```

Launch Backend
```bash
python backend.py
```

**Frontend:**

Launch Frontend
```bash
cd Frontend/nutrition-frontend
npm install
npm start
```

## Database access

### 🛠️ Database Access with DBeaver

DBeaver is a free and powerful GUI for inspecting your PostgreSQL database. You can use it to explore tables, run queries, and debug data directly.

#### 🔽 Step 1: Install DBeaver

* Download and install the Community Edition from:
  👉 [https://dbeaver.io/download/](https://dbeaver.io/download/)

#### ⚙️ Step 2: Connect to the Dockerized Database

1. **Open DBeaver** and click `Database → New Database Connection`
2. Choose **PostgreSQL** and click **Next**
3. Enter the following connection info:

| Field        | Value            |
| ------------ | ---------------- |
| **Host**     | `localhost`      |
| **Port**     | `5432`           |
| **Database** | `nutrition`      |
| **Username** | `nutrition_user` |
| **Password** | `nutrition_pass` |

4. Click **Test Connection**.
   If prompted to download the PostgreSQL driver, allow it.
5. Click **Finish** to connect.

> 📝 If the connection fails, make sure the Docker containers are running with:
>
> ```bash
> docker-compose up
> ```
