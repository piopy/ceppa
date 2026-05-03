# 20260122 - Integrazione Tavily per ricerca web

**Stato:** Accettato

**Contesto:** La generazione di lezioni si basava esclusivamente sulle conoscenze del modello LLM, portando a contenuti potenzialmente obsoleti o incompleti. Per migliorare la qualità e l'accuratezza delle lezioni, si è deciso di integrare una fonte di ricerca web esterna.

**Decisione:** Integrare l'API **Tavily Search** come motore di ricerca web per arricchire i contenuti delle lezioni con informazioni aggiornate. Il flusso di generazione ora:
1. Riceve l'argomento della lezione
2. Effettua una ricerca web tramite Tavily per trovare fonti recenti e rilevanti
3. Passa i risultati della ricerca (contenuti web) come contesto aggiuntivo al prompt LLM
4. L'LLM genera la lezione incorporando le informazioni trovate

È stato creato un servizio dedicato (`tavily_service.py`) per gestire le chiamate API e l'elaborazione dei risultati. I risultati possono essere opzionalmente filtrati per dominio.

**Conseguenze:**
- Nuova dipendenza: `httpx` per chiamate asincrone, chiave API Tavily richiesta
- Lezioni più aggiornate e contestualizzate con fonti reali
- Nuovo schema per rappresentare i risultati di ricerca
- Incremento del tempo di generazione per la fase di ricerca
- Rischio di raggiungere limiti di chiamate API Tavily

**File chiave introdotti:**
- `backend/app/services/tavily_service.py` - Servizio di ricerca web Tavily
- `backend/app/api/api_v1/endpoints/tavily.py` - Endpoint per interazione con Tavily
- `backend/app/schemas/course.py` - Schema per risultati di ricerca