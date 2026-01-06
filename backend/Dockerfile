FROM python:3.10-slim

# Install system dependencies for Pandoc and LaTeX
RUN apt-get update && apt-get install -y --no-install-recommends \
    pandoc \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-latex-extra \
    texlive-xetex \
    lmodern \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create fontconfig cache directory with proper permissions
RUN mkdir -p /var/cache/fontconfig && chmod -R 777 /var/cache/fontconfig
ENV XDG_CACHE_HOME=/tmp/.cache

# Install Poetry globally so all users can access it
ENV POETRY_HOME="/opt/poetry"
RUN curl -sSL https://install.python-poetry.org | python3 - \
    && ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock* /app/

# Install dependencies (configured to not create a virtualenv inside the container for simplicity in dev)
RUN poetry config virtualenvs.create false \
    && poetry install --no-root --no-interaction --no-ansi

# We don't copy the code here because we volume map it in docker-compose
# But we need pyproject.toml to be present to install deps if we were building for prod.
# For dev, we'll install in the command or check. For now, we assume pyproject exists.

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
