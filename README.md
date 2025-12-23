# C.E.P.P.A. 🚀
## Componente di Elaborazione Procedure Per Apprendimento

Benvenuto in **C.E.P.P.A.**, un'applicazione web avanzata progettata per rivoluzionare il modo in cui apprendiamo nuove competenze. L'idea alla base è semplice ma potente: **trasformare qualsiasi richiesta di apprendimento in una guida didattica strutturata, professionale e stampabile**.

Grazie all'integrazione di **Intelligenza Artificiale Generativa** e strumenti di **Typesetting professionale (LaTeX)**, C.E.P.P.A. non si limita a darti una risposta testuale, ma crea un vero e proprio manuale in PDF pronto per lo studio.

---

## Disclaimer
L'applicazione è frutto di una progettazione volutamente "vibe", non ha intenzioni di essere un'applicazione per imparare, ma piuttosto un simpatico esperimento per capire come funziona Antigravity di Google.

## 🏗️ Architettura del Progetto

Il sistema è costruito seguendo un'architettura a microservizi containerizzati, garantendo scalabilità, isolamento e facilità di deploy.

### 1. Backend 🧠 (Python + FastAPI)
Il "cervello" dell'operazione.
*   **Framework**: [FastAPI](https://fastapi.tiangolo.com/). Scelto per le sue prestazioni (Asynchronous), la generazione automatica della documentazione (OpenAPI) e la tipizzazione forte (Pydantic).
*   **AI Engine**: Integrazione con **LLM (Large Language Models)**. Attualmente configurato per utilizzare **Google Gemini** tramite un layer di compatibilità OpenAI, garantendo risposte di alta qualità a costi contenuti.
*   **PDF Engine**: Combinazione di **Pandoc** e **LaTeX (TexLive)**. 
    *   *Perché questa scelta?* Molte librerie Python per PDF (come ReportLab o FPDF) offrono un output visivo povero o richiedono un enorme lavoro manuale di layout. Usando Pandoc per convertire il Markdown dell'IA in LaTeX e poi compilando in PDF, otteniamo una formattazione tipografica perfetta (font, margini, sillabazione) automaticamente.
*   **Gestione Pacchetti**: [Poetry](https://python-poetry.org/). Per una gestione deterministica delle dipendenze e degli ambienti virtuali.

### 2. Frontend 🎨 (React + Vite)
L'interfaccia utente, progettata per stupire e coinvolgere.
*   **Framework**: React 19.
*   **Build Tool**: Vite (per uno sviluppo rapido e build ottimizzate).
*   **Design Philosophy**: **"Premium Native"**.
    *   Non abbiamo utilizzato framework CSS pesanti (come Bootstrap).
    *   Abbiamo evitato l'overhead di Tailwind per questo specifico caso d'uso, preferendo **CSS Vanilla** altamente ottimizzato per creare effetti di **Glassmorphism**, gradienti fluidi e animazioni.
*   **Features UI**:
    *   **Interactive Background**: Uno sfondo dinamico con sfere "fluide" che reagiscono al movimento del mouse, scritto in Canvas API per massimizzare le performance (60fps stabili).
    *   **Smart Suggestions**: Una barra di ricerca che suggerisce ciclicamente argomenti di studio con effetti di dissolvenza eleganti.

### 3. Orchestrazione 🐳 (Docker Compose)
Tutto il sistema si avvia con un singolo comando.
*   Il backend include un'installazione completa di `texlive-latex-extra` per garantire che tutti i pacchetti LaTeX necessari siano disponibili senza configurazioni manuali sul sistema host.

---

## 🛠️ Stack Tecnologico in Dettaglio

| Componente | Tecnologia | Ruolo |
| :--- | :--- | :--- |
| **Linguaggio (BE)** | Python 3.11 | Logica di business e integrazione AI |
| **API Framework** | FastAPI | Esposizione endpoint REST |
| **Linguaggio (FE)** | JavaScript (ES6+) | Logica client-side |
| **UI Library** | React | Componenti reattivi |
| **Styling** | CSS3 (Variables, Flexbox, Grid) | Design personalizzato |
| **Conversion** | Pandoc + LaTeX | Generazione documenti PDF di alta qualità |
| **Container** | Docker | Ambiente di esecuzione isolato |

---

## 🚀 Come Eseguire il Progetto

### Prerequisiti
*   **Docker** e **Docker Compose** installati sulla macchina.
*   Una **API Key** valida (attualmente configurato per endpoint compatibili OpenAI, es. Google Gemini).

### Installazione e Avvio

1.  **Configurazione Ambiente**:
    Crea un file `.env` nella directory principale (`/educimi`) copiando l'esempio o inserendo le tue credenziali:
    ```env
    OPENAI_API_KEY=la_tua_chiave_api_qui
    OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
    ```

2.  **Avvio Container**:
    Dalla root del progetto, esegui:
    ```bash
    docker-compose up --build
    ```
    *Nota: La prima build potrebbe richiedere alcuni minuti poiché docker deve scaricare l'immagine base con TexLive (~3GB).*

3.  **Accesso**:
    *   **Frontend (App)**: Apri il browser su [http://localhost:3000](http://localhost:3000)
    *   **Backend (Docs)**: API Swagger disponibili su [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧠 Note di Sviluppo & Decisioni Architetturali

### Perché non generare il PDF direttamente con Javascript?
Generare PDF lato client (es. `jspdf`) produce spesso documenti di bassa qualità, con testi non selezionabili o impaginazioni rotte. Passando per il server e usando LaTeX, garantiamo che ogni guida prodotta sembri uscita da una casa editrice professionale.

### Gestione della Concorrenza
Il backend utilizza `BackgroundTasks` di FastAPI. Quando un PDF viene generato e inviato all'utente, una task in background si occupa di pulire i file temporanei dal server, mantenendo il sistema pulito e prevenendo l'esaurimento dello spazio su disco.

### UI/UX "Alive"
L'obiettivo della UI non è solo funzionale ma emozionale. Lo sfondo interattivo e i suggerimenti che cambiano (con transizioni `opacity`) servono a rendere l'attesa (necessaria per la generazione AI) meno noiosa e a dare l'idea di un sistema "vivo" e intelligente.

---

## 🔮 Roadmap (Sviluppi Futuri)

Le seguenti funzionalità sono in fase di progettazione/sviluppo:
*   [ ] **Assistente Virtuale (Chat)**: Un professore di lingua basato su IA persistente per conversare in tempo reale.
*   [ ] **Internazionalizzazione (i18n)**: Supporto completo per multilingua sia nella UI che nei contenuti generati.
*   [ ] **Cronologia**: Salvataggio locale delle guide generate in precedenza.

---

*Autore: Antonio V.*
*Powered by: Google DeepMind & Human Creativity*
