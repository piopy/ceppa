#!/bin/bash

# Se HF Spaces ha fornito secrets reali per OPENAI, aggiorna il .env
[ -n "$OPENAI_API_KEY" ] && sed -i "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=$OPENAI_API_KEY/" /app/backend/.env
[ -n "$OPENAI_BASE_URL" ] && sed -i "s|^OPENAI_BASE_URL=.*|OPENAI_BASE_URL=$OPENAI_BASE_URL|" /app/backend/.env

# Se DATABASE_URL è passato come env, aggiorna il .env
if [ -n "$DATABASE_URL" ]; then
    if grep -q "^DATABASE_URL=" /app/backend/.env; then
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" /app/backend/.env
    else
        echo "DATABASE_URL=$DATABASE_URL" >> /app/backend/.env
    fi
fi

# Avvia Uvicorn in un ambiente pulito: rimuove OPENAI_API_KEY e credenziali Google
# dall'ambiente del processo, così la libreria openai usa SOLO l'api_key esplicita.
cd /app/backend
exec env -u OPENAI_API_KEY -u OPENAI_BASE_URL -u GOOGLE_API_KEY -u GOOGLE_APPLICATION_CREDENTIALS \
    uvicorn app.main:app --host 0.0.0.0 --port 7860
