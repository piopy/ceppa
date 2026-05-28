# TODO

## Current version - Bugfix

- [ ] On HuggingFace: "Registration failed. Username might be taken." After first registration (no users on db) (maybe db connection fault?)

## v0.2.1 — Migrazioni DB con Alembic

- [x] Inizializzare Alembic nel progetto backend
- [x] Configurare `alembic.ini` e `env.py` per usare `DATABASE_URL` e `Base.metadata`
- [x] Generare la migration iniziale: `alembic revision --autogenerate -m "initial"`
- [x] Rimuovere `Base.metadata.create_all()` da `main.py` startup event
- [x] Aggiungere `alembic upgrade head` nello script di avvio (`start.sh`) **prima** di `uvicorn`
- [x] **`DATABASE_URL` auto-costruito se assente** da variabili `POSTGRES_*`
- [x] Attesa DB attivo (TCP check, max 60s) prima di alembic + uvicorn
- [ ] Testare su Hugging Face Spaces

## v0.3.0 — Import/Export Lezioni Utente

_⚠️ Da implementare solo dopo conferma che tutto funziona su HF Spaces._

- [ ] Endpoint `GET /api/v1/lessons/export` — esporta tutte le lezioni di un utente in JSON
- [ ] Endpoint `POST /api/v1/lessons/import` — importa lezioni da JSON
- [ ] UI nel frontend: pulsanti Export/Import nella Dashboard o nel profilo