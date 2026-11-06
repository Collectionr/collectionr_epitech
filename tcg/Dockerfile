# syntax=docker/dockerfile:1

# Multi-stage build for the TCG microservice (COLLR-686).
# Build context: tcg/ (see .dockerignore). Python version aligned with requires-python in pyproject.toml.
# Multi-arch (x86-64 + ARM64): the base image and every pinned dependency exist for both, e.g.
#   docker buildx build --platform linux/amd64,linux/arm64 -t collectionr-tcg tcg/

ARG PYTHON_VERSION=3.13.9

# ---------------------------------------------------------------------------
# Stage 1 — build: pinned dependencies + the tcg_service package in a virtualenv
# ---------------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim-bookworm AS build

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

# Dependencies first: this layer stays cached as long as requirements.txt does not change.
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-deps .

# ---------------------------------------------------------------------------
# Stage 2 — runtime image (no build files, no sources, non-root)
# ---------------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

# Numeric UID/GID so that Kubernetes can enforce runAsNonRoot.
ARG APP_UID=10001

# APP_ENV=staging by default: interactive docs (/docs, /openapi.json) stay disabled unless
# the environment explicitly sets APP_ENV=dev.
ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=staging

RUN groupadd --system --gid ${APP_UID} tcg \
    && useradd --system --uid ${APP_UID} --gid tcg --no-create-home --shell /usr/sbin/nologin tcg

COPY --from=build /opt/venv /opt/venv

WORKDIR /app

USER ${APP_UID}:${APP_UID}

EXPOSE 8000

CMD ["uvicorn", "tcg_service.main:app_factory", "--factory", "--host", "0.0.0.0", "--port", "8000"]
