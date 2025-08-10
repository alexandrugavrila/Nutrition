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
    "port": 5432,
}

