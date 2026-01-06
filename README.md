# AutoLearn - Generazione Intelligente di Corsi

⚠️ **DISCLAIMER**: Questo è un progetto **VIBE** (sperimentale) creato esclusivamente per testare le capacità di generazione automatica di contenuti con [Google Autogen](https://ai.google.dev/). **NON è un progetto di produzione.**

---

## 📚 Descrizione

**AutoLearn** è una piattaforma web per la generazione automatica e intelligente di corsi online multilingui. Utilizza l'API di Google Generative AI (Gemini) per:

- ✨ Generare corsi completi da una descrizione
- 📖 Creare lezioni strutturate con indice e contenuti
- 📄 Esportare lezioni in PDF con formattazione professionale
- 🌍 Supporto multilingue (Italiano e Inglese)
- 📊 Tracciamento del progresso di completamento
- 🔐 Autenticazione sicura con JWT e bcrypt

---

## 🏗️ Architettura

```
autolearn/
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
- Google Generative AI SDK (LLM)

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
- GOOGLE_API_KEY (generare da [Google AI Studio](https://aistudio.google.com))

### Setup

1. **Clonare la repository**
   ```bash
   git clone https://github.com/piopy/cippa.git
   cd cippa
   ```

2. **Configurare le variabili d'ambiente**
   ```bash
   # Creare envs/develop.env e inserire:
   OPENAI_API_KEY=<<API_KEY>>
   OPENAI_BASE_URL=<<BASE_URL>>
   LLM_MODEL=<<MODEL_NAME>>
   DEFAULT_LANGUAGE=it
   ```

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
1. Cliccare "Create New Course"
2. Inserire titolo e descrizione
3. Selezionare lingua (Italiano/Inglese)
4. Submit → l'AI genererà il corso
```

### 3. Generare Lezioni
```
1. Aprire un corso
2. Cliccare su una voce dell'indice
3. La lezione viene generata e mostrata
4. Cliccare "Download PDF" per esportare
5. Il progresso viene tracciato automaticamente
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
POST   /auth/register          # Registrazione
POST   /auth/login             # Login
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

## 🛠️ Variabili d'Ambiente

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `GOOGLE_API_KEY` | API key Google Generative AI | `AIzaSy...` |
| `DATABASE_URL` | URL PostgreSQL | `postgresql://user:pass@postgres:5432/autolearn` |
| `SECRET_KEY` | Secret per JWT signing | `super-secret-key` |
| `DEFAULT_LANGUAGE` | Lingua di default | `it` o `en` |
| `PYTHONUNBUFFERED` | Logs in real-time | `1` |

---

## 📋 Funzionalità Attuali

- ✅ Generazione automatica di corsi tramite AI
- ✅ Generazione di lezioni con contenuti strutturati
- ✅ Indice lezioni con scroll animation
- ✅ Esportazione PDF con fallback engine (xelatex → pdflatex)
- ✅ Autenticazione JWT sicura
- ✅ Tracciamento progresso lezioni
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
- No hardcoded secrets (gestiti via .env)
- Validation Pydantic v2 su tutti gli input

**NB**: Questo è un prototipo. Per produzione:
- Implementare rate limiting
- Aggiungere logging/monitoring
- Implementare refresh token rotation
- Aggiungere 2FA
- Implementare backup database

---

## 🐛 Troubleshooting

### "PDF generation failed"
- Assicurarsi che `data/user_files/` ha permessi 777
- Verificare che pandoc è disponibile nel container
- Controllare i log: `docker logs autolearn-backend-1`

### "Invalid API key"
- Verificare che `GOOGLE_API_KEY` è corretto in `.env`
- Controllare che la chiave non è scaduta in Google AI Studio

### "Connection refused" al database
- Aspettare che PostgreSQL sia avviato (5-10 secondi)
- Verificare `docker-compose ps`
- Controllare i log di postgres

---

## 📝 Licenza

MIT - Vedi LICENSE per dettagli

---

## 👤 Autore

Creato come progetto VIBE per testare le capacità di Google Autogen

**⚠️ Non adatto per uso in produzione.**

---

## 📞 Support

Per issue e segnalazioni, aprire un'issue su GitHub (cippa repository).
