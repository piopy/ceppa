# 20260107 - Architettura V2: Refactoring completo backend e frontend

**Stato:** Accettato

**Contesto:** Il prototipo iniziale (commit `8274eb7`) utilizzava un backend monolitico in FastAPI senza autenticazione né struttura API definita, e un frontend React con componenti inline. Si è reso necessario un refactoring profondo per garantire scalabilità, sicurezza e manutenibilità.

**Decisione:** Ristrutturare completamente l'applicazione con:
- **Backend strutturato**:
  - Endpoint API suddivisi per dominio: `auth.py`, `courses.py`, `lessons.py`
  - Sistema di autenticazione JWT con schemi `Token` e `User`
  - Layer di dipendenze (`deps.py`) per iniezione dipendenze e protezione rotte
  - Modelli database ORM con `base.py` e schemi Pydantic separati
  - Config centralizzata (`config.py`) e sicurezza (`security.py`)
  - Database connection management via `db.py`
- **Frontend rinnovato**:
  - Introduzione di Tailwind CSS per lo styling
  - Sistema di routing lato client (pagine separate: `Dashboard`, `CourseView`, `Login`, `Register`)
  - Context API per l'autenticazione (`AuthContext.jsx`)
  - API client dedicato (`client.js`) per comunicazione backend
  - Componenti riutilizzabili (`Layout.jsx`, `ProtectedRoute.jsx`)
- **Materiali didattici rimossi dal repository** (file PDF di esempio eliminati)

**Conseguenze:**
- Breaking change completo: l'applicazione V1 non è più compatibile
- Maggiore sicurezza con autenticazione JWT e password hashing
- Migliore organizzazione del codice con separazione delle responsabilità
- Facilità di aggiungere nuovi endpoint e funzionalità grazie alla struttura modulare
- Il frontend ora richiede autenticazione per l'accesso alle rotte protette

**File chiave introdotti:**
- `backend/app/api/api_v1/endpoints/auth.py` - Endpoint autenticazione
- `backend/app/api/api_v1/endpoints/courses.py` - CRUD corsi
- `backend/app/api/api_v1/endpoints/lessons.py` - CRUD lezioni
- `backend/app/core/security.py` - Gestione password JWT
- `frontend/src/context/AuthContext.jsx` - Stato autenticazione globale
- `frontend/src/api/client.js` - Client HTTP