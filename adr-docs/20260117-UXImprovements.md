# 20260117 - Miglioramenti UX: tracking, Q&A, drag & drop e merge PDF

**Stato:** Accettato

**Contesto:** L'esperienza utente necessitava di miglioramenti significativi: tracciamento visivo delle lezioni completate, interazione con i contenuti tramite domande, riorganizzazione intuitiva delle lezioni e download combinato di più PDF.

**Decisione:** Implementare le seguenti funzionalità UX:
1. **Lezioni completate in verde** nella Dashboard, per dare feedback visivo immediato del progresso
2. **Sistema di domande e risposte sotto ogni lezione**, permettendo agli utenti di fare domande e ricevere risposte dall'LLM
3. **Drag & drop delle card delle lezioni** per riordinare gli argomenti trascinandoli
4. **Download di PDF uniti (merged)**, per scaricare tutte le lezioni di un corso in un unico documento PDF
5. **Versione 0.0.3** rilasciata

**Conseguenze:**
- UX più ricca e interattiva
- Aggiunta di tabelle database per memorizzare domande e risposte
- Nuove dipendenze frontend per supportare drag & drop
- Maggiore complessità nel frontend (stato drag, overlay domande)

**File chiave:**
- `frontend/src/pages/Dashboard.jsx` - Colore verde lezioni completate
- `frontend/src/pages/CourseView.jsx` - Q&A sotto lezioni, drag & drop