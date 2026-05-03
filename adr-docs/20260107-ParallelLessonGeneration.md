# 20260107 - Generazione massiva parallela delle lezioni

**Stato:** Accettato

**Contesto:** La generazione delle lezioni per un corso avveniva in modo sequenziale: ogni lezione veniva generata una dopo l'altra, rendendo il processo molto lento per corsi con molti argomenti. Gli utenti dovevano attendere molto tempo prima di poter visualizzare l'intero corso.

**Decisione:** Implementare la generazione parallela delle lezioni utilizzando chiamate asincrone concorrenti all'API LLM. Le lezioni vengono generate simultaneamente anziché in sequenza, riducendo drasticamente il tempo totale di generazione. Il numero di lezioni generate in parallelo è configurabile tramite ambiente (`MAX_CONCURRENT_LESSONS` nel file `local.env`).

**Conseguenze:**
- Riduzione significativa del tempo di generazione dei corsi
- Race condition gestita tramite stato delle lezioni nel database
- Rischio di rate limiting delle API LLM se il parallelismo è troppo alto
- Modifiche sostanziali all'endpoint di generazione corsi e al frontend per gestire aggiornamenti in tempo reale

**File modificati:**
- `backend/app/api/api_v1/endpoints/courses.py` - Generazione parallela
- `backend/app/core/config.py` - Config massimo lezioni concorrenti
- `envs/local.env` - Variabile `MAX_CONCURRENT_LESSONS`
- `frontend/src/pages/CourseView.jsx` - UI per stato generazione parallela