# Changelog

Tutte le modifiche notabili di questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
e questo progetto aderisce semanticamente a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Le versioni ufficiali sono tratte dal file `frontend/src/version.json` di ogni commit significativo.

---

## [1.1.0] - PDF Caching, Loading Indicators & PDF Download per Labs

### Aggiunto
- Sistema di caching per i PDF generati
- Indicatori di caricamento nel frontend durante la generazione dei PDF
- Funzionalità di download PDF per gli hands‑on labs
- Possibilità di scaricare i lab in formato PDF

### Modificato
- Ottimizzazione delle performance per la generazione PDF

---

## [1.0.1] - Lab Regeneration, Q&A, Favorite Labs & Hands‑on Labs (BREAKING CHANGE)

### Aggiunto
- Funzionalità di rigenerazione dei lab con feedback utente
- Sistema di domande e risposte (Q&A) per ogni lab
- Supporto per lab preferiti (favorite)
- Possibilità di aggiungere note personali ai lab
- Generazione PDF per i lab
- **Nuovo modulo per i corsi hands‑on (laboratori pratici)**
  - CRUD endpoints per la gestione dei lab
  - Logica di generazione per i lab (30 % teoria, 70 % pratica)
  - UI completa per l'interazione con i lab
  - Pagine dedicate: HandsOnLabs e LabView

### Modificato
- Miglioramenti nella visualizzazione dei lab

### Database - Breaking Change
Nuove tabelle aggiunte per gli hands-on labs:
- `hands_on_courses`: corsi hands-on (topic, title, description, index_json, language, custom_instructions)
- `labs`: singoli lab (hands_on_course_id, title, path_in_index, theory_content, steps_json, pdf_path, is_completed, is_favorite, user_notes)
- `lab_questions`: domande e risposte sui lab (lab_id, question, answer)

#### Migrazione da versione precedente (1.0.0 → 1.0.1)
```sql
CREATE TABLE hands_on_courses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    topic VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT,
    index_json TEXT,
    language VARCHAR DEFAULT 'en',
    custom_instructions TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE labs (
    id SERIAL PRIMARY KEY,
    hands_on_course_id INTEGER REFERENCES hands_on_courses(id),
    title VARCHAR NOT NULL,
    path_in_index VARCHAR,
    theory_content TEXT,
    steps_json TEXT,
    pdf_path VARCHAR,
    is_completed BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    user_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lab_questions (
    id SERIAL PRIMARY KEY,
    lab_id INTEGER REFERENCES labs(id) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## [1.0.0] - Version Bump to 1.0.0

### Modificato
- Bump di versione ufficiale a 1.0.0 (da `frontend/src/version.json`)

---

## [0.1.4] - Profile API Keys & Favorite Lessons (BREAKING CHANGE)

### Aggiunto
- Impostazioni API Keys nel profilo utente
- Possibilità di configurare chiavi API personalizzate (OpenAI, Tavily)
- Supporto per modelli LLM personalizzati
- Lezioni preferite (favorite)
- Sistema di domande sotto ogni lezione
- Integrazione con Tavily per ricerche web
- Ricerca fonti recenti per le risposte generate
- Citazione delle fonti nelle risposte
- Formattazione migliorata delle fonti nel contesto di ricerca
- Pagination per il recupero dei corsi
- Gestione migliorata dei crediti Tavily

### Database - Breaking Change
Nuove colonne aggiunte alla tabella `users`:
- `custom_openai_api_key`: chiave API OpenAI personale
- `custom_openai_base_url`: URL base personalizzato per OpenAI
- `custom_llm_model`: modello LLM personalizzato
- `custom_tavily_api_key`: chiave API Tavily personale

Nuova colonna alla tabella `lessons`:
- `is_favorite`: boolean per le lezioni preferite

#### Migrazione da versione precedente (0.1.2 → 0.1.4)
```sql
ALTER TABLE users ADD COLUMN custom_openai_api_key VARCHAR;
ALTER TABLE users ADD COLUMN custom_openai_base_url VARCHAR;
ALTER TABLE users ADD COLUMN custom_llm_model VARCHAR;
ALTER TABLE users ADD COLUMN custom_tavily_api_key VARCHAR;

ALTER TABLE lessons ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
```

### Modificato
- Corretto bug nella cancellazione di lezioni con domande (errore SQL)
- Corretto bug nella ricerca web
- Bugfix sull'unione dei markdown
- Workaround per le nuove API di Google

---

## [0.1.2] - Tavily Search, Dark Mode & Drag‑Drop

### Aggiunto
- Drag & drop delle cards delle lezioni
- Dark mode
- Conversione ad EPUB
- Immersive mode migliorato
- Scrollbar CSS personalizzata

### Modificato
- Fix CSS del codice e dark mode

---

## [0.0.3] - Version Tag

### Aggiunto
- Versione 0.0.3 ufficiale (commit 35b5919)

---

## [0.0.2] - PDF & Lezioni

### Aggiunto
- Download dei PDF mergiati
- Possibilità di fare domande sotto una lezione
- Lezioni completate colorate di verde nella dashboard
- Possibilità di rigenerare la lezione con feedback
- Possibilità di cancellare un argomento
- Pulsanti view e download PDF nelle lezioni
- Rinomina del progetto da "Autolearn" a "Ceppa"
- Pulsante di edit per le lezioni
- Supporto per lingue multiple (custom languages)

### Modificato
- Fix tabelle a frontend
- Aggiornamenti grafici vari
- Miglioramenti nel README

---

## [0.0.1] - Initial Release

### Aggiunto
- Initial commit
- Struttura base del progetto FastAPI + React
- Sistema di autenticazione utenti
- Creazione e gestione corsi
- Generazione lezioni con LLM
- Generazione in parallelo delle lezioni
- Supporto multilingua (en/it)
- Restart policy per Docker
- Configurazione ambiente locale