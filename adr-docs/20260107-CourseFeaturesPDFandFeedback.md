# 20260107 - Funzionalità corso: PDF, cancellazione argomenti e rigenerazione lezioni

**Stato:** Accettato

**Contesto:** Gli utenti necessitavano di strumenti per interagire concretamente con i corsi generati: visualizzare e scaricare le lezioni in PDF, rimuovere argomenti non desiderati, e rigenerare lezioni fornendo feedback per correggere la direzione del contenuto generato dall'LLM.

**Decisione:** Implementare tre funzionalità chiave:
1. **Pulsanti "View" e "Download PDF"** per ogni lezione, che permettono rispettivamente di visualizzare e scaricare il PDF generato
2. **Cancellazione di un argomento** dall'indice del corso, con conseguente rigenerazione dell'indice aggiornato
3. **Rigenerazione della lezione con feedback**: l'utente può fornire un feedback testuale e la lezione viene rigenerata dall'LLM tenendo conto delle indicazioni ricevute

**Conseguenze:**
- Migliore esperienza utente con accesso diretto ai PDF
- Maggiore flessibilità nella personalizzazione dei corsi
- Iterazione guidata dall'utente sul contenuto generato
- Modifiche sia backend (API courses/lessons) che frontend

**File modificati:**
- `backend/app/api/api_v1/endpoints/courses.py` - Endpoint per cancellazione argomenti
- `backend/app/services/llm_service.py` - Supporto rigenerazione con feedback
- `backend/app/services/pdf_service.py` - Endpoint di download PDF
- `frontend/src/pages/CourseView.jsx` - UI pulsanti view/download e feedback