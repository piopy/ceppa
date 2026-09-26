import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client, { exportUserData, importUserData } from '../api/client';
import { Save, ArrowLeft, Key, Server, Bot, Search, Loader2, Eye, EyeOff, Download, Upload } from 'lucide-react';

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [settings, setSettings] = useState({
    custom_openai_api_key: '',
    custom_openai_base_url: '',
    custom_llm_model: '',
    custom_tavily_api_key: '',
  });
  const [keysSet, setKeysSet] = useState({ openai: false, tavily: false });

  // Visibility toggles for sensitive fields
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await client.get('/users/me');
      setSettings({
        custom_openai_api_key: '',
        custom_openai_base_url: res.data.custom_openai_base_url || '',
        custom_llm_model: res.data.custom_llm_model || '',
        custom_tavily_api_key: '',
      });
      setKeysSet({
        openai: !!res.data.custom_openai_api_key_set,
        tavily: !!res.data.custom_tavily_api_key_set,
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setErrorMsg('Impostazioni non caricate.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      // Blank = keep esistente, null = clear esplicito via pulsante? Qui: blank keep, solo non-blank inviato.
      // Per base_url/model (non segreti): stringa vuota = clear come prima.
      const payload = {
        custom_openai_base_url: settings.custom_openai_base_url.trim() || null,
        custom_llm_model: settings.custom_llm_model.trim() || null,
      };
      if (settings.custom_openai_api_key.trim()) payload.custom_openai_api_key = settings.custom_openai_api_key.trim();
      if (settings.custom_tavily_api_key.trim()) payload.custom_tavily_api_key = settings.custom_tavily_api_key.trim();
      await client.put('/users/me/settings', payload);
      setSettings((p) => ({ ...p, custom_openai_api_key: '', custom_tavily_api_key: '' }));
      setSuccessMsg('Impostazioni salvate.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setErrorMsg(err.response?.data?.detail || 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Profilo</h1>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Sostituisci le impostazioni LLM e ricerca web con le tue chiavi. Lascia vuoto per usare i default del server.
        </p>
      </div>

      {/* LLM Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          Configurazione LLM
        </h2>

        <div className="space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span className="flex items-center gap-1">
                <Key className="w-4 h-4" />
                Chiave API compatibile OpenAI
              </span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.custom_openai_api_key}
                onChange={(e) => handleChange('custom_openai_api_key', e.target.value)}
                placeholder={keysSet.openai ? '•••••• (configurata — blank per tenere)' : 'sk-... or your Gemini API key'}
                className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary focus:border-primary transition"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* URL base */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span className="flex items-center gap-1">
                <Server className="w-4 h-4" />
                URL base
              </span>
            </label>
            <input
              type="text"
              value={settings.custom_openai_base_url}
              onChange={(e) => handleChange('custom_openai_base_url', e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span className="flex items-center gap-1">
                <Bot className="w-4 h-4" />
                Modello
              </span>
            </label>
            <input
              type="text"
              value={settings.custom_llm_model}
              onChange={(e) => handleChange('custom_llm_model', e.target.value)}
              placeholder="gemini-3-flash-preview"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>
        </div>
      </div>

      {/* Tavily Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Ricerca web (Tavily)
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <span className="flex items-center gap-1">
              <Key className="w-4 h-4" />
              Chiave API Tavily
            </span>
          </label>
          <div className="relative">
            <input
              type={showTavilyKey ? 'text' : 'password'}
              value={settings.custom_tavily_api_key}
              onChange={(e) => handleChange('custom_tavily_api_key', e.target.value)}
              placeholder={keysSet.tavily ? '•••••• (configurata — blank per tenere)' : 'tvly-...'}
              className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
            <button
              type="button"
              onClick={() => setShowTavilyKey(!showTavilyKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showTavilyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Data Export/Import */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          Export / Import dati
        </h2>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Esporta corsi, lab, domande e progressi in JSON per backup o migrazione.
            </p>
            <button
              onClick={async () => {
                setExporting(true);
                try {
                  await exportUserData();
                } catch (err) {
                  console.error('Export failed:', err);
                  setErrorMsg('Export non riuscito: ' + (err.response?.data?.detail || err.message));
                } finally {
                  setExporting(false);
                }
              }}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? 'Esporto...' : 'Esporta tutto'}
            </button>
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Importa da un export precedente. Aggiunge corsi e lab a quelli esistenti.
            </p>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={(e) => {
                  setImportFile(e.target.files[0] || null);
                  setImportResult(null);
                  setErrorMsg('');
                }}
                className="block text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 dark:hover:file:bg-gray-600 transition"
              />
              <button
                onClick={async () => {
                  if (!importFile) return;
                  setImporting(true);
                  setImportResult(null);
                  setErrorMsg('');
                  try {
                    const result = await importUserData(importFile);
                    setImportResult(result);
                    setImportFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                } catch (err) {
                  console.error('Import failed:', err);
                  const detail = err.response?.data?.detail;
                  const msg = Array.isArray(detail)
                    ? detail.map(d => d.msg || JSON.stringify(d)).join('; ')
                    : detail || err.message;
                  setErrorMsg('Import non riuscito: ' + msg);
                  } finally {
                    setImporting(false);
                  }
                }}
                disabled={importing || !importFile}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {importing ? 'Importo...' : 'Importa'}
              </button>
            </div>
            {importResult && (
              <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Importati: {importResult.courses_imported} corsi, {importResult.lessons_imported} lezioni, {importResult.hands_on_courses_imported} corsi lab, {importResult.labs_imported} lab.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
          <p className="text-sm text-green-700 dark:text-green-300">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-700 dark:text-red-300">{errorMsg}</p>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        {saving ? 'Salvo...' : 'Salva impostazioni'}
      </button>
    </div>
  );
}
