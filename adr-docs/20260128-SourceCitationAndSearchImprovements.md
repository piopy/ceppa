# 20260128 - Miglioramento citazione fonti e formattazione risultati ricerca

**Stato:** Accettato

**Contesto:** Con l'introduzione della ricerca web tramite Tavily, le lezioni includevano riferimenti a fonti web. Tuttavia, le citazioni non erano formattate in modo chiaro e la visualizzazione delle fonti nei risultati di ricerca risultava confusa per l'utente.

**Decisione:** Migliorare il sistema di citazione delle fonti con:
- Istruzioni più precise per l'LLM su come citare le fonti nelle risposte (formato standard con link)
- Migliore formattazione delle fonti nel contesto di ricerca passato all'LLM
- Visualizzazione più chiara delle fonti consultate nella UI della lezione

**Conseguenze:**
- Lezioni con citazioni più chiare e verificabili
- Prompt LLM aggiornati per includere formattazione fonti standardizzata
- Migliore trasparenza sulle fonti utilizzate per generare i contenuti

**File modificati:**
- `backend/app/services/llm_service.py` - Istruzioni citazione fonti nei prompt
- `backend/app/services/tavily_service.py` - Formattazione risultati ricerca