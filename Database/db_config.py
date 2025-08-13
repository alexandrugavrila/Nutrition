"""Shared configuration for database scripts."""

import os

# Directory where the database scripts reside
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Default database connection settings
DB_CONFIG = {
    "dbname": "nutrition",
    "user": "nutrition_user",
    "password": "nutrition_pass",
    "host": "localhost",
    # Allow the database port to be overridden so scripts can connect to
    # branch-specific containers that map Postgres to a unique host port.
    "port": int(os.environ.get("DB_PORT", 5432)),
}

