# TODO

## Current version - Bugfix

- [x] On HuggingFace: "Registration failed. Username might be taken." After first registration (no users on db) (maybe db connection fault?)

## v0.2.1 — Migrazioni DB con Alembic

- [x] Inizializzare Alembic nel progetto backend
- [x] Configurare `alembic.ini` e `env.py` per usare `DATABASE_URL` e `Base.metadata`
- [x] Generare la migration iniziale: `alembic revision --autogenerate -m "initial"`
- [x] Rimuovere `Base.metadata.create_all()` da `main.py` startup event
- [x] Aggiungere `alembic upgrade head` nello script di avvio (`start.sh`) **prima** di `uvicorn`
- [x] **`DATABASE_URL` auto-costruito se assente** da variabili `POSTGRES_*`
- [x] Attesa DB attivo (TCP check, max 60s) prima di alembic + uvicorn
- [x] Testare su Hugging Face Spaces

## v0.3.0 — Import/Export Lezioni Utente

_⚠️ Da implementare solo dopo conferma che tutto funziona su HF Spaces._

- [x] Endpoint `GET /api/v1/export-import/export` — esporta tutte le lezioni + laboratori + Q&A + stato in JSON
- [x] Endpoint `POST /api/v1/export-import/import` — importa dati da JSON
- [x] UI nel frontend: pulsanti Export/Import nella pagina Profilo