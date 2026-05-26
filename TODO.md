# TODO

## Current version - Bugfix

- [ ] "Registration failed. Username might be taken." After first registration (no users on db) (maybe db connection fault?)

## v0.2.1 — Migrazioni DB con Alembic

- [ ] Inizializzare Alembic nel progetto backend
  ```bash
  cd backend && poetry run alembic init migrations
  ```
- [ ] Configurare `alembic.ini` e `env.py` per usare `DATABASE_URL` e `Base.metadata`
- [ ] Generare la migration iniziale: `alembic revision --autogenerate -m "initial"`
- [ ] Rimuovere `Base.metadata.create_all()` da `main.py` startup event
- [ ] Aggiungere `alembic upgrade head` nello script di avvio (`start.sh`) **prima** di `uvicorn`
- [ ] **`DATABASE_URL` auto-costruito se assente**: se `DATABASE_URL` non è impostato, `start.sh` lo costruisce a partire da:
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_HOST`
  - `POSTGRES_PORT` (default `5432`)
  - `POSTGRES_DBNAME`
  
  Formula: `postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DBNAME}`
- [ ] Testare su Hugging Face Spaces

## v0.3.0 — Import/Export Lezioni Utente

_⚠️ Da implementare solo dopo conferma che tutto funziona su HF Spaces._

- [ ] Endpoint `GET /api/v1/lessons/export` — esporta tutte le lezioni di un utente in JSON
- [ ] Endpoint `POST /api/v1/lessons/import` — importa lezioni da JSON
- [ ] UI nel frontend: pulsanti Export/Import nella Dashboard o nel profilo