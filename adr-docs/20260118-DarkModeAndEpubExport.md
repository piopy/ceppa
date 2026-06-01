# 20260118 - Dark Mode, Immersive Mode ed export EPUB

**Stato:** Accettato

**Contesto:** L'applicazione mancava di opzioni di personalizzazione visiva e formati di esportazione alternativi. Gli utenti richiedevano una modalità scura per l'utilizzo notturno e la possibilità di esportare i corsi in formato EPUB per lettori ebook.

**Decisione:** Implementare tre nuove funzionalità:
1. **Dark mode**: sistema di tema chiaro/scuro con toggle nell'interfaccia, utilizzando classi Tailwind e variabili CSS per gestire i colori
2. **Immersive mode**: modalità a schermo intero per la lettura delle lezioni, rimuovendo distrazioni dall'interfaccia
3. **Conversione EPUB**: nuovo endpoint backend per generare file EPUB dai corsi, sfruttando la libreria `ebooklib` (Python)

**Conseguenze:**
- Dark mode ha richiesto modifiche estese a tutti i componenti frontend per supportare le classi tema
- Aggiunta dipendenza `ebooklib` al backend
- Nuovo endpoint API per download EPUB
- Esperienza di lettura migliorata significativamente

**File modificati:**
- `frontend/src/components/Layout.jsx` - Toggle dark mode
- `frontend/src/index.css` - Variabili CSS per tema scuro
- `frontend/src/pages/CourseView.jsx` - Immersive mode e pulsante EPUB
- `frontend/src/pages/Dashboard.jsx` - Supporto tema scuro
- `frontend/tailwind.config.js` - Configurazione dark mode
- `backend/app/api/api_v1/endpoints/courses.py` - Endpoint generazione EPUB
- `backend/app/services/pdf_service.py` - Logica conversione EPUB