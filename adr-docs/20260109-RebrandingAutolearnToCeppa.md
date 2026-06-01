# 20260109 - Rebranding del progetto: da Autolearn a Ceppa

**Stato:** Accettato

**Contesto:** Il progetto è stato rinominato da "Autolearn" a "Ceppa". Il nome originale non rifletteva più la visione del prodotto e si è scelto un nome più caratteristico e distintivo.

**Decisione:** Rinominare l'intero progetto, aggiornando tutti i riferimenti presenti in:
- `README.md` - Documentazione principale
- `backend/app/core/config.py` - Nome applicazione nelle configurazioni
- `backend/app/main.py` - Nome applicazione FastAPI
- `backend/pyproject.toml` - Metadati del progetto Python
- `frontend/src/components/Layout.jsx` - Nome visualizzato nell'interfaccia
- `frontend/src/pages/CourseView.jsx` - Riferimenti nel contenuto
- `frontend/src/pages/Login.jsx` - Nome nella pagina di login
- `frontend/src/version.json` - Metadati versione

Sono state inoltre aggiunte:
- Possibilità di segnare le lezioni come completate
- Pulsante GitHub nel layout
- Numero di versione nell'app tramite `version.json`

**Conseguenze:**
- Breaking change minimo (solo nome visualizzato, nessun impatto API/database)
- Identità di prodotto più forte e riconoscibile
- Miglioramento UX con tracking del completamento lezioni
- Informazioni di versione disponibili nell'app

**File chiave:**
- `frontend/src/version.json` - Nuovo file per tracciamento versione