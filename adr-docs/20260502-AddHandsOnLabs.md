# 20260502 - Aggiunta moduli Hands-On Labs

**Stato:** Accettato

**Contesto:** Il progetto necessitava di un modo per fornire laboratori pratici agli utenti, permettendo loro di applicare i concetti appresi in un ambiente controllato.

**Decisione:** Introdurre un nuovo modulo per gli hands-on labs, includendo:
- Nuove tabelle database: `hands_on_courses`, `labs`, e `lab_questions`
- Endpoint API CRUD per la gestione dei lab
- Pagine frontend `HandsOnLabs` e `LabView` per l'interazione
- Logica di generazione con suddivisione 30% teoria / 70% pratica

**Conseguenze:** 
- Breaking change allo schema del database (richiede script di migrazione)
- Componenti UI aggiuntivi e routing nel frontend
- Maggiore complessità nei servizi backend

**Migrazione:**
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