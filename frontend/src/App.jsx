import { useState, useEffect } from 'react'
import axios from 'axios'
import './index.css'
import InteractiveBackground from './InteractiveBackground'

const EXAMPLES = [
  "Generami una serie di esercizi per imparare dbt (da base ad avanzato)",
  "Generami una guida completa sull'utilizzo di Terraform",
  "Spiegami i concetti fondamentali di Kubernetes per principianti",
  "Crea un percorso di studio per diventare Data Engineer",
  "Genera un tutorial pratico su React Hooks e Context API",
  "Spiegami come ottimizzare le query SQL su PostgreSQL",
  "Genera una guida all'uso di Docker e Docker Compose",
  "Crea esercizi pratici per imparare Python per la Data Science",
  "Spiegami la gestione dello stato in applicazioni front-end complesse",
  "Genera una roadmap per imparare Machine Learning da zero",
  "Crea una guida alla sicurezza nelle API REST con FastAPI",
  "Spiegami come implementare CI/CD con GitHub Actions",
  "Genera esempi di unit testing avanzato in Python con pytest",
  "Crea un tutorial sui design pattern più comuni in Java",
  "Spiegami l'architettura a microservizi con esempi pratici",
  "Genera una guida sull'orchestrazione dei dati con Dagster",
  "Crea esercizi per padroneggiare le espressioni regolari (Regex)",
  "Spiegami come monitorare le performance di un'applicazione web"
];

function App() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [fileName, setFileName] = useState('')
  
  // Advanced mode state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  
  // Example rotation state
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [fadeState, setFadeState] = useState('visible'); // 'visible' or 'hidden'

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    // Initial random example
    setCurrentExampleIndex(Math.floor(Math.random() * EXAMPLES.length));

    const interval = setInterval(() => {
      setFadeState('hidden');
      
      setTimeout(() => {
        setCurrentExampleIndex(prev => {
           // Ensure simple random rotation without immediate repeat if possible, 
           // or just random 
           let nextIndex = Math.floor(Math.random() * EXAMPLES.length);
           while(nextIndex === prev && EXAMPLES.length > 1) {
             nextIndex = Math.floor(Math.random() * EXAMPLES.length);
           }
           return nextIndex;
        });
        setFadeState('visible');
      }, 500); // Wait for fade out to complete (0.5s matches CSS transition)

    }, 3500); // 3000s display + 500ms fade transition roughly

    return () => clearInterval(interval);
  }, []);

  const handleExampleClick = () => {
    setTopic(EXAMPLES[currentExampleIndex]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setPdfUrl(null);

    try {
      const payload = { 
        topic,
        custom_instructions: customInstructions.trim() || undefined
      };

      const response = await axios.post(`${API_URL}/generate`, payload, {
        responseType: 'blob' // Important for file download
      });

      // Create a URL for the blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      setPdfUrl(url);
      
      // Extract filename from headers or generate one
      const contentDisposition = response.headers['content-disposition'];
      const now = new Date();
      const timestamp = now.getFullYear().toString().slice(-2) + 
        String(now.getMonth() + 1).padStart(2, '0') + 
        String(now.getDate()).padStart(2, '0') + '_' + 
        String(now.getHours()).padStart(2, '0')+
        String(now.getMinutes()).padStart(2, '0')+
        String(now.getSeconds()).padStart(2, '0');
      const cleanTopic = topic.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      let filename = `guida_${cleanTopic}_${timestamp}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }
      setFileName(filename);

    } catch (err) {
      console.error(err);
      setError("Si è verificato un errore durante la generazione della guida. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <InteractiveBackground />
      <div className="container">
        <h1>C . E . P . P . A .</h1>
        <h2><i>Componente di Elaborazione Procedure Per Apprendimento</i></h2>
        
        <div className="card">
          <form onSubmit={handleSubmit} className="input-group">
            <label htmlFor="topic">Cosa vuoi imparare oggi?</label>
            <input
              type="text"
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Es. Terraform, React Hooks, Astrofisica..."
              disabled={loading}
            />
            
            {/* Dynamic Examples Area */}
            <div style={{ minHeight: '1.5em', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                <p 
                    className={`fade-text ${fadeState === 'hidden' ? 'hidden' : ''}`}
                    onClick={handleExampleClick}
                    style={{
                        fontSize: '0.85rem',
                        color: 'rgba(148, 163, 184, 0.8)',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        margin: 0,
                        cursor: 'pointer'
                    }}
                >
                    "{EXAMPLES[currentExampleIndex]}"
                </p>
            </div>

            {/* Advanced Mode Toggle */}
            <div className="advanced-mode-container">
              <button 
                type="button" 
                className="advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Modalità Semplice ⬆️' : 'Modalità Avanzata ⬇️'}
              </button>
              
              <div className={`advanced-content ${showAdvanced ? 'open' : ''}`}>
                <label htmlFor="instructions" style={{ marginTop: '1rem', display: 'block' }}>Istruzioni personalizzate</label>
                <textarea
                  id="instructions"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Descrivi come vuoi la guida: tono (serio, ironico), stile (accademico, divulgativo), focus (esercizi, teoria)..."
                  rows={4}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" disabled={loading || !topic.trim()}>
              {loading ? 'Generazione in corso...' : 'Genera Guida'}
            </button>
          </form>

          {loading && (
            <div className="loader">
              <div className="spinner"></div>
              <p style={{ marginLeft: '1rem', color: '#94a3b8' }}>L'IA sta scrivendo la tua guida...</p>
            </div>
          )}

          {error && (
            <div className="error-message" style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {pdfUrl && !loading && (
            <div className="success-message">
              <h3>Guida Pronta! 🎉</h3>
              <p>La tua guida su <strong>{topic}</strong> è stata generata con successo.</p>
              <a href={pdfUrl} download={fileName} className="download-link">
                ⬇️ Scarica PDF ({fileName})
              </a>
            </div>
          )}
        </div>
        
        {/* Footer removed as requested */}
      </div>
    </>
  )
}

export default App
