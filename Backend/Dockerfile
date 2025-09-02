FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install build dependencies for psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies system-wide to ensure modules are available
COPY Backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r /tmp/requirements.txt

# Copy backend source preserving package structure
COPY Backend/ /app/Backend

# Copy Alembic configuration for database migrations
## Alembic config now lives within the Backend/ tree and is copied above.

CMD ["python", "-m", "uvicorn", "Backend.backend:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
