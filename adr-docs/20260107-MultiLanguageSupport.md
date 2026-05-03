# 20260107 - Supporto multilingua nella generazione dei corsi

**Stato:** Accettato

**Contesto:** L'applicazione inizialmente supportava solo la generazione di corsi in inglese. Gli utenti necessitavano di corsi in diverse lingue per adattarsi alle proprie esigenze formative.

**Decisione:** Aggiungere il supporto per lingue personalizzate nella generazione dei corsi, permettendo all'utente di selezionare la lingua desiderata dal frontend. Il prompt LLM è stato modificato per accettare un parametro `language` che viene passato al modello per generare contenuti nella lingua specificata. La selezione della lingua è stata integrata nella pagina Dashboard del frontend.

**Conseguenze:**
- Modifica minima al backend: solo il servizio LLM è stato aggiornato
- Modifica minima al frontend: aggiunta selezione lingua nella Dashboard
- L'LLM si occupa di tradurre e generare contenuti coerentemente nella lingua richiesta
- Nessun cambiamento allo schema del database

**File modificati:**
- `backend/app/services/llm_service.py` - Aggiunto parametro `language` ai prompt di generazione
- `frontend/src/pages/Dashboard.jsx` - Aggiunta UI per selezione lingua