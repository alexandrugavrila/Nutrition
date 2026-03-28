# syntax=docker/dockerfile:1.7

FROM python:3.12.10-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Backend/requirements.txt /tmp/requirements.txt
RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install --no-cache-dir -r /tmp/requirements.txt

# Development target keeps reload ergonomics and mounts source as a bind volume.
FROM base AS dev
CMD ["python", "-m", "uvicorn", "Backend.backend:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod

ARG APP_UID=10001
ARG APP_GID=10001

RUN groupadd --gid "${APP_GID}" app \
    && useradd --create-home --uid "${APP_UID}" --gid app --shell /usr/sbin/nologin app

COPY Backend/ /app/Backend
RUN chown -R app:app /app

USER app

ENV HOST=0.0.0.0 \
    PORT=8000 \
    WEB_CONCURRENCY=2 \
    GUNICORN_TIMEOUT=60 \
    GUNICORN_GRACEFUL_TIMEOUT=30 \
    GUNICORN_KEEPALIVE=5 \
    LOG_LEVEL=info

EXPOSE 8000

CMD ["sh", "-c", "exec gunicorn Backend.backend:app -k uvicorn.workers.UvicornWorker --bind ${HOST}:${PORT} --workers ${WEB_CONCURRENCY} --timeout ${GUNICORN_TIMEOUT} --graceful-timeout ${GUNICORN_GRACEFUL_TIMEOUT} --keep-alive ${GUNICORN_KEEPALIVE} --access-logfile - --error-logfile - --log-level ${LOG_LEVEL}"]
