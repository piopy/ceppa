#!/bin/bash
set -euo pipefail

# ── Costruisci DATABASE_URL se non è già impostato ─────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
    if [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${POSTGRES_HOST:-}" ] && [ -n "${POSTGRES_DBNAME:-}" ]; then
        POSTGRES_PORT="${POSTGRES_PORT:-5432}"
        export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DBNAME}"
        echo "[start.sh] DATABASE_URL costruita da variabili POSTGRES_*"
    else
        echo "[start.sh] ERRORE: DATABASE_URL non impostata e variabili POSTGRES_* incomplete." >&2
        exit 1
    fi
fi

# ── Aggiorna .env con i secrets forniti da HF Spaces ──────────────────────────
[ -n "${OPENAI_API_KEY:-}" ] && sed -i "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=$OPENAI_API_KEY/" /app/backend/.env
[ -n "${OPENAI_BASE_URL:-}" ] && sed -i "s|^OPENAI_BASE_URL=.*|OPENAI_BASE_URL=$OPENAI_BASE_URL|" /app/backend/.env

if grep -q "^DATABASE_URL=" /app/backend/.env; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" /app/backend/.env
else
    echo "DATABASE_URL=$DATABASE_URL" >> /app/backend/.env
fi

# ── Aspetta che il DB accetti connessioni (max 60 s) ──────────────────────────
# Estrae host e porta da DATABASE_URL (supporta postgresql+asyncpg:// e postgresql://)
_url="${DATABASE_URL#postgresql+asyncpg://}"
_url="${_url#postgresql://}"
_hostport="${_url#*@}"
_hostport="${_hostport%%/*}"
DB_HOST="${_hostport%%:*}"
DB_PORT="${_hostport##*:}"
DB_PORT="${DB_PORT:-5432}"

echo "[start.sh] Attendo che il DB sia raggiungibile su ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 30); do
    if (echo > /dev/tcp/"${DB_HOST}"/"${DB_PORT}") 2>/dev/null; then
        echo "[start.sh] DB raggiungibile dopo ${i} tentativo/i."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "[start.sh] ERRORE: DB non raggiungibile dopo 30 tentativi (60s)." >&2
        exit 1
    fi
    sleep 2
done

# ── Applica migrazioni DB ─────────────────────────────────────────────────────
cd /app/backend
echo "[start.sh] Eseguo alembic upgrade head..."
set +e
ALEMBIC_OUTPUT=$(DATABASE_URL="$DATABASE_URL" \
    OPENAI_API_KEY="${OPENAI_API_KEY:-dummy}" \
    OPENAI_BASE_URL="${OPENAI_BASE_URL:-https://dummy}" \
    alembic upgrade head 2>&1)
ALEMBIC_EXIT_CODE=$?
set -e
if [ $ALEMBIC_EXIT_CODE -ne 0 ]; then
    if echo "$ALEMBIC_OUTPUT" | grep -qi "already exists"; then
        echo "[start.sh] Tabelle già esistenti, eseguo alembic stamp head..."
        DATABASE_URL="$DATABASE_URL" \
            OPENAI_API_KEY="${OPENAI_API_KEY:-dummy}" \
            OPENAI_BASE_URL="${OPENAI_BASE_URL:-https://dummy}" \
            alembic stamp head
        echo "[start.sh] Head stampato con successo."
    else
        echo "[start.sh] ERRORE: Migrazione DB fallita:" >&2
        echo "$ALEMBIC_OUTPUT" >&2
        exit 1
    fi
fi
echo "[start.sh] Migrazioni completate."

# ── Avvia Uvicorn in ambiente pulito ─────────────────────────────────────────
exec env -u OPENAI_API_KEY -u OPENAI_BASE_URL -u GOOGLE_API_KEY -u GOOGLE_APPLICATION_CREDENTIALS \
    uvicorn app.main:app --host 0.0.0.0 --port 7860
