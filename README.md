# Ceppa (o Autolearn perchè faceva più figo) - Generazione Intelligente di Corsi

⚠️ **DISCLAIMER**: Questo è un progetto "VIBE" (quindi sperimentale) creato esclusivamente per testare le capacità di generazione automatica di contenuti con Antigravity. 

**NON è un progetto di produzione e devo dire che alcune parti tipo il dockerfile scritte cosi funzionano, certo, ma sono più che ottimizzabili.**

### Perchè è stato creato questo progetto?
Ceppa nasce dalla voglia di sperimentare quanto i modelli di linguaggio sono capaci di insegnare e strutturare piani di apprendimento guidati oltre che generare codice e immagini di brainrots.

Dopo 5 anni di apprendimento questi modelli sono in grado di generare contenuti di qualità accettabile per essere fruiti da utenti finali?

Sono in grado di restituire indietro agli utenti quello che "hanno appreso" in modo strutturato e coerente?

Ma soprattutto, **qualcuno mi saprà spiegare perchè in python `(0.1 + 0.2) != 0.3`?**

---
## Alcuni screenshoots

![Schermata utente](image.png)
![Lezione](image-1.png)
![PDF Generato](image-2.png)

---

## 🏗️ Architettura del Progetto

**Ceppa** è una piattaforma web per la generazione automatica e intelligente di corsi online multilingui. Utilizza un LLM compatibile OpenAI per:

- ✨ Generare corsi completi da una descrizione
- 🗺️ Importare roadmap da roadmap.sh e studiarle come corsi
- 🧪 Hands-on labs con spine project, livelli guided/challenge e criteri di accettazione
- 📖 Creare lezioni strutturate con indice e contenuti
- 💬 Thread e chat AI su lezioni e lab, con memoria della conversazione
- 📄 Esportare lezioni in PDF con formattazione professionale
- 🔥 Streak giorni di attività, command palette (⌘K)
- 🌍 Supporto multilingue (Italiano e Inglese)
- 📊 Tracciamento del progresso di completamento
- 🔐 Autenticazione sicura con JWT e bcrypt

---

## 🏗️ Architettura

```
Ceppa/
├── backend/              # FastAPI (Python 3.10)
│   ├── app/
│   │   ├── api/          # Endpoints API
│   │   ├── core/         # Config, DB, Security
│   │   ├── models/       # SQLAlchemy ORM
│   │   ├── schemas/      # Pydantic models
│   │   └── services/     # LLM & PDF generation
│   ├── Dockerfile
│   └── pyproject.toml    # Poetry dependencies
│
├── frontend/             # React 18 + Vite
│   ├── src/
│   │   ├── pages/        # Dashboard, CourseView, Auth
│   │   ├── components/   # Layout, ProtectedRoute
│   │   ├── context/      # AuthContext
│   │   └── api/          # API client
│   ├── Dockerfile
│   └── vite.config.js
│
├── data/                 # Persistent volumes
│   └── user_files/       # Generated PDFs
│
└── docker-compose.yml    # Orchestrazione
```

### Stack Tecnologico

**Backend:**
- FastAPI (async web framework)
- SQLAlchemy + PostgreSQL (database asincrono)
- Pydantic v2 (validation)
- Python-jose + bcrypt (JWT & password hashing)
- Pandoc + xelatex (PDF generation)
- Openai (LLM)

**Frontend:**
- React 18.3.1
- Vite 6.0.5 (build tool)
- TailwindCSS 3.4.17 (styling)
- React Router 6.28.0 (navigation)
- Framer Motion 11.15.0 (animations)
- Axios (HTTP client)

**DevOps:**
- Docker & Docker Compose
- PostgreSQL 15 (database)

---

## 🚀 Quick Start

### Prerequisiti
- Docker & Docker Compose
- Una API key per un provider LLM compatibile OpenAI (es. [Google AI Studio](https://aistudio.google.com) per Gemini, oppure OpenCode Zen/Go).

### Setup

1. **Clonare la repository**
   ```bash
   git clone https://github.com/piopy/ceppa.git
   cd ceppa
   ```

2. **Configurare le variabili d'ambiente**
   ```bash
   # Creare envs/local.env e inserire:
   OPENAI_API_KEY=<<API_KEY>>
   OPENAI_BASE_URL=<<BASE_URL>>
   LLM_MODEL=<<MODEL_NAME>>
   DEFAULT_LANGUAGE=<<it/en>>
   MAX_CONCURRENT_WORKERS=<<NUMBER>>
   POSTGRES_USER=<<USER>>
   POSTGRES_PASSWORD=<<PASSWORD>>
   POSTGRES_DB=<<DB_NAME>>
   DATABASE_URL=<<DATABASE_URL>>
   SECRET_KEY=<<openssl rand -hex 32>>
   ```

   ```bash
   # Modificare il .env per scegliere le porte da esporre
   BACKEND_PORT=<<HOST_BACKEND_PORT>>
   FRONTEND_PORT=<<HOST_FRONTEND_PORT>>
   DB_PORT=<<HOST_DB_PORT>>

   ENV_MODE=<<local/develop/deploy>>
   ```

   Note:
   - Le migrazioni DB (`alembic upgrade head`) girano da sole all'avvio del backend.
   - `SECRET_KEY` firma JWT e cifratura chiavi: i token creati prima di un cambio chiave vanno riloggati.
   - Provider tipo OpenCode Zen/Go: il backend invia già `x-opencode-session` + user agent proprio;
     i modelli serviti via Responses API (es. `muse-spark-*`) sono instradati in automatico.
   

3. **Avviare i container**
   ```bash
   docker-compose up -d
   ```

4. **Accedere all'applicazione**
   - Frontend: http://localhost:5173
   - API Docs: http://localhost:8000/docs
   - Database: localhost:5432

---

## 📖 Utilizzo

### 1. Registrazione / Login
- Creare un account con email e password (minimo 8 caratteri)
- Le password vengono hashate con bcrypt

### 2. Creare un Corso
```
1. Inserire cosa si vuole apprendere
2. Selezionare lingua (Italiano/Inglese/Custom)
3. Cliccare "Learn now" → l'AI genererà il corso
```

### 3. Generare Lezioni
```
1. Aprire un corso
2. Cliccare su una voce dell'indice o Generare tutte le lezioni dell'indice
3. La lezione viene generata e mostrata
4. Cliccare "Download PDF" per esportare, "Mark as Complete" per completare o "View Lesson" per aprire il PDF in un'altra tab
5. E' possibile rigenerare la lezione se necessario indicando eventuali preferenze per migliorare la generazione
```

### 4. Tracciamento Progresso
- Barra di progresso visuale con:
  - **Blu**: lezioni generate
  - **Verde**: lezioni lette (completate)
  - **Grigio**: lezioni non generate
- Contatore: "X/Y completate"

---

## 🔌 API Endpoints

### Autenticazione
```
POST   /auth/register          # Registrazione (password min 8)
POST   /auth/login             # Login (rate limit 10 tentativi/5min)
POST   /auth/refresh           # Refresh token
POST   /auth/logout            # Logout
```

### Corsi
```
POST   /courses                # Creare corso
GET    /courses                # Lista corsi utente
GET    /courses/{id}           # Dettagli corso
GET    /courses/{id}/lessons   # Progresso lezioni
DELETE /courses/{id}           # Eliminare corso
```

### Lezioni
```
POST   /lessons/{course_id}    # Generare lezione
GET    /lessons/{id}           # Recuperare lezione
GET    /lessons/{id}/pdf       # Scarica PDF
PUT    /lessons/{id}/complete  # Marca come completata
```

### Configurazione
```
GET    /config/languages       # Lingue disponibili
```


---

## 📋 Funzionalità Attuali

- ✅ Generazione automatica di corsi tramite AI
- ✅ Roadmap roadmap.sh importabili come corsi
- ✅ Hands-on labs v2 (spine project, guided/challenge, acceptance criteria)
- ✅ Thread + chat AI su lezioni e lab, con memoria
- ✅ Generazione di lezioni con contenuti strutturati
- ✅ Indice lezioni come skill path con stati
- ✅ Esportazione PDF con fallback engine (xelatex → pdflatex)
- ✅ Autenticazione JWT sicura + refresh + rate limit login
- ✅ Tracciamento progresso lezioni (su totale indice)
- ✅ Streak attività + command palette (⌘K)
- ✅ Supporto multilingue (IT/EN)
- ✅ UI responsiva con TailwindCSS
- ✅ Animazioni fluide con Framer Motion

## 🚧 Limitazioni Conosciute

- ⚠️ **Progetto VIBE**: non è production-ready
- ⚠️ Nessuna gestione avanzata di errori di generazione
- ⚠️ PDF generati in memoria (no cache lungo termine)
- ⚠️ Nessuna paginazione nei corsi (scala male con molti corsi)
- ⚠️ No caching dei contenuti generati
- ⚠️ Nessun sistema di backup automatico

---

## 🔐 Sicurezza

- Password hashate con bcrypt
- JWT con HS256
- CORS configurato
- No hardcoded secrets (gestiti via ENV_MODE.env)
- Validation Pydantic v2 su tutti gli input

---

## 🐛 Troubleshooting

### "PDF generation failed"
- Riprovare in un secondo momento
- Assicurarsi che `data/user_files/` ha permessi 777
- Verificare che pandoc è disponibile nel container
- Controllare i log: `docker logs Ceppa-backend-1`

### "Invalid API key"
- Verificare che la chiave sia corretta
- Controllare che la chiave non è scaduta o si sono raggiunti i limiti di utilizzo in Google AI Studio

### "Connection refused" al database
- Aspettare che PostgreSQL sia avviato (5-10 secondi)
- Verificare `docker-compose ps`
- Controllare i log di postgres

---
## TIP per la generazione a costo zero
- Gemini offre il modello 3 flash gratuitamente con limiti di utilizzo giornalieri (20RPD);
- In alternativa, OpenRouter nel momento in cui sto scrivendo offre accesso gratuito a modelli come Deepseek e GPT-oss.


## 📝 Licenza

[MIT - Vedi Wikipedia per dettagli](https://it.wikipedia.org/wiki/Licenza_MIT)

## 🙏 Attribuzioni

- Roadmap, titoli e link della sezione Roadmaps forniti da [roadmap.sh](https://roadmap.sh),
  usati con attribuzione. Le lezioni generate dalla AI possono contenere errori:
  verificare sui materiali ufficiali prima di un uso critico.
