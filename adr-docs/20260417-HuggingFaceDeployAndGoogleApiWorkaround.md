# 20260417 - Deploy su Hugging Face Spaces e workaround API Google

**Stato:** Accettato

**Contesto:** Si è deciso di pubblicare l'applicazione su Hugging Face Spaces per renderla accessibile pubblicamente. Durante la configurazione sono emersi due problemi: (1) le porte backend/frontend/database dovevano essere riconfigurate per l'ambiente HF, (2) Google aveva smesso di generare API key nel formato precedente, rompendo la ricerca web tramite Tavily (che utilizzava Google come provider sottostante).

**Decisione:** 
1. **Deploy HF Spaces**: Creazione di un `Dockerfile.hf` dedicato per Hugging Face Spaces, con configurazione delle porte e variabili d'ambiente appropriate. Riconfigurazione delle porte backend, frontend e database nel file `.env`.
2. **Sicurezza**: Derivazione della chiave Fernet da `SECRET_KEY` o `DATABASE_URL` invece di usare una chiave hardcoded. Aggiunta di `SECRET_KEY` alle variabili d'ambiente.
3. **Workaround Google API**: Rimozione di `OPENAI_API_KEY` e `OPENAI_BASE_URL` dalle variabili d'ambiente del servizio LLM per affidarsi alla configurazione predefinita. Modifiche per adattarsi ai nuovi formati delle API Google/Tavily.
4. **Debug e fix**: Diversi commit di debug per risolvere problemi di compatibilità con le nuove API di Google.

**Conseguenze:**
- L'applicazione è ora distribuibile su Hugging Face Spaces
- Maggiore sicurezza nella gestione delle chiavi crittografiche
- Compatibilità mantenuta con le nuove API di Google
- Il Dockerfile per HF è mantenuto separato dal Dockerfile di sviluppo locale
- Rischio di future breaking change nelle API dei provider esterni

**File chiave:**
- `Dockerfile.hf` - Nuovo Dockerfile per Hugging Face Spaces (184 linee)
- `backend/app/core/security.py` - Refactoring derivazione chiave Fernet
- `envs/local.env` - Aggiunta `SECRET_KEY`