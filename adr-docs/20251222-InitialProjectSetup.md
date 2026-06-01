# 20251222 - Setup iniziale del progetto

**Stato:** Accettato

**Contesto:** Si intendeva creare un'applicazione per la generazione automatica di corsi e lezioni su qualsiasi argomento, utilizzando modelli linguistici (LLM). L'applicazione doveva essere moderna, containerizzata e facilmente distribuibile.

**Decisione:** Adottare un'architettura full-stack containerizzata con:
- **Backend**: Python con framework FastAPI, PostgreSQL come database, integrazione con API OpenAI per generazione contenuti LLM e generazione PDF
- **Frontend**: React con Vite, con styling personalizzato via CSS
- **Containerizzazione**: Docker Compose per orchestrazione dei servizi (backend, frontend, database)
- **Struttura**: API RESTful per la comunicazione frontend-backend

**Conseguenze:**
- Setup rapido dell'ambiente di sviluppo locale tramite `docker-compose up`
- Isolamento dei servizi e facilità di deploy
- Scelta di PostgreSQL come database relazionale per la persistenza dei dati
- Architettura modulare che ha permesso iterazioni rapide nelle fasi successive

**File chiave introdotti:**
- `docker-compose.yml` - Orchestrazione container
- `backend/Dockerfile` - Container backend Python
- `frontend/Dockerfile` - Container frontend Node.js
- `backend/app/main.py` - Entry point FastAPI
- `backend/app/services/llm_service.py` - Servizio di interazione con LLM
- `backend/app/services/pdf_service.py` - Generazione PDF
- `frontend/src/App.jsx` - Componente principale React