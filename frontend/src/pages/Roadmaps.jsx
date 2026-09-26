import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { toast } from 'sonner';
import { CardSkeleton, Empty, confirmDialog } from '../components/ui';
import { Map, Search, Plus, Trash2, BookOpen, ExternalLink, Languages } from 'lucide-react';

export default function Roadmaps() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('it');
  const [customLanguage, setCustomLanguage] = useState('');
  const [creating, setCreating] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cat, my] = await Promise.all([
        client.get('/roadmaps'),
        client.get('/courses/', { params: { source: 'roadmap', limit: 100 } }),
      ]);
      setCatalog(cat.data);
      setMine(my.data.items);
    } catch (err) {
      toast.error('Failed to load roadmaps.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (rm) => {
    const selectedLanguage = language === 'custom' ? customLanguage : language;
    if (language === 'custom' && !customLanguage) {
      toast.warning('Indica la lingua custom.');
      return;
    }
    setCreating(rm.slug);
    try {
      const res = await client.post('/courses/', { topic: rm.title, roadmap_slug: rm.slug, language: selectedLanguage });
      toast.success(`Percorso "${rm.title}" creato.`);
      navigate(`/course/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create roadmap course.');
    } finally {
      setCreating(null);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!await confirmDialog({ title: 'Eliminare percorso?', confirmLabel: 'Elimina', danger: true })) return;
    try {
      await client.delete(`/courses/${id}`);
      setMine(mine.filter((c) => c.id !== id));
      toast.success('Percorso eliminato.');
    } catch {
      toast.error('Failed to delete.');
    }
  };

  const filtered = catalog.filter((r) =>
    (r.title + ' ' + (r.description || '')).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl p-8">
      <header className="mb-8">
        <h2 className="flex items-center gap-3 text-4xl font-extrabold text-gray-900 dark:text-gray-100">
          <Map className="h-8 w-8 text-primary" /> Roadmaps
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Percorsi da <a href="https://roadmap.sh" target="_blank" rel="noreferrer" className="text-primary hover:underline">roadmap.sh</a>.
          Click su una roadmap per crearne un corso: le lezioni si generano come in Dashboard.
        </p>
        <div className="mt-4 flex max-w-2xl flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca roadmap..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700">
            <Languages className="h-4 w-4 text-gray-500" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-sm font-medium outline-none dark:text-gray-200"
              title="Lingua lezioni generate"
            >
              <option value="it">🇮🇹 Italiano</option>
              <option value="en">🇬🇧 English</option>
              <option value="custom">✏️ Custom</option>
            </select>
          </div>
          {language === 'custom' && (
            <input
              type="text"
              placeholder="es, fr, de..."
              value={customLanguage}
              onChange={(e) => setCustomLanguage(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          )}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          <section className="mb-12">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-bold dark:text-gray-100">
              <BookOpen className="h-6 w-6 text-primary" /> My Roadmap Paths ({mine.length})
            </h3>
            {mine.length === 0 ? (
              <Empty title="Nessun percorso iniziato" hint="Scegli una roadmap dal catalogo sotto." />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {mine.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/course/${c.id}`)}
                    className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold dark:text-gray-100">{c.title}</h4>
                      <button
                        onClick={(e) => handleDelete(e, c.id)}
                        title="Elimina"
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="tabular mt-2 text-sm text-gray-500">
                      {c.completed_lessons}/{c.total_lessons} completate
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-4 text-xl font-bold dark:text-gray-100">Catalogo ({filtered.length})</h3>
            {filtered.length === 0 ? (
              <Empty title="Nessuna roadmap trovata" hint="Prova un'altra ricerca." />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((r) => (
                  <div key={r.slug} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                    <h4 className="font-bold dark:text-gray-100">{r.title}</h4>
                    <p className="mt-1 flex-1 text-sm text-gray-600 line-clamp-3 dark:text-gray-400">{r.description}</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleCreate(r)}
                        disabled={creating === r.slug}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" /> {creating === r.slug ? 'Creo...' : 'Inizia percorso'}
                      </button>
                      <a
                        href={`https://roadmap.sh/${r.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Apri su roadmap.sh"
                        className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
