# Contributing

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
