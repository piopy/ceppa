# 20260214 - Paginazione, profilo utente, API keys personali e lezioni preferite

**Stato:** Accettato

**Contesto:** L'applicazione cresceva e presentava diversi limiti: (1) la lista dei corsi diventava ingestibile senza paginazione, (2) gli utenti volevano usare le proprie chiavi API per i servizi LLM/Tavily, (3) non c'era modo di contrassegnare lezioni preferite, (4) mancava una pagina profilo utente.

**Decisione:** Implementare un insieme di funzionalità correlate:
1. **Paginazione corsi**: endpoint `read_courses` ora restituisce metadati di paginazione (totale, pagina, dimensione) tramite nuovo schema `CoursesListResponse`
2. **Profilo utente** (`Profile.jsx`): nuova pagina frontend per gestire:
   - API keys personali (OpenAI, Tavily, Google)
   - Salvataggio delle preferenze nel database
3. **Lezioni preferite**: aggiunto campo `is_favorite` al modello `Lesson`, con endpoint per toggle preferito
4. **Istruzioni personalizzate**: nella Dashboard gli utenti possono aggiungere istruzioni custom per guidare la generazione dei corsi
5. **Breaking change**: lo schema della risposta API per i corsi è cambiato (ora incapsulato in `CoursesListResponse`)

**Conseguenze:**
- Breaking change API: i client devono gestire il nuovo formato di risposta paginata
- Nuova tabella/colonne nel database per memorizzare API keys e preferiti
- Maggiore complessità backend con gestione sicura delle chiavi API
- Nuova pagina frontend (`Profile.jsx`) con 228 linee di codice
- Possibilità per utenti avanzati di usare i propri modelli LLM

**File chiave introdotti:**
- `frontend/src/pages/Profile.jsx` - Nuova pagina profilo utente
- `backend/app/api/api_v1/endpoints/users.py` - Endpoint gestione profilo