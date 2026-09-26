import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { Search, BookOpen, FlaskConical, Map, User, Plus, Moon, Sun, LogOut, CornerDownLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

// Command palette Cmd+K: corsi, lab, azioni. Frontend-only, nessun backend.
export default function CommandPalette() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [courses, setCourses] = useState([]);
  const [labs, setLabs] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('ceppa-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ceppa-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    (async () => {
      try {
        const [c, l] = await Promise.all([
          client.get('/courses/', { params: { limit: 50 } }),
          client.get('/hands-on/', { params: { limit: 50 } }),
        ]);
        setCourses(c.data.items || []);
        setLabs(l.data.items || []);
      } catch { /* offline: solo azioni */ }
    })();
  }, [open ]);

  const dark = document.documentElement.classList.contains('dark');

  const actions = [
    { id: 'new-course', label: 'Nuovo corso…', hint: 'Dashboard', icon: Plus, run: () => navigate('/') },
    { id: 'go-labs', label: 'Vai a Hands-on Labs', icon: FlaskConical, run: () => navigate('/labs') },
    { id: 'go-roadmaps', label: 'Vai a Roadmaps', icon: Map, run: () => navigate('/roadmaps') },
    { id: 'go-profile', label: 'Vai a Profilo', icon: User, run: () => navigate('/profile') },
    {
      id: 'theme', label: dark ? 'Tema chiaro' : 'Tema scuro', icon: dark ? Sun : Moon,
      run: () => {
        const next = !dark;
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('darkMode', String(next));
      },
    },
    { id: 'logout', label: 'Logout', icon: LogOut, run: () => { logout(); navigate('/login'); } },
  ];

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s) => !q || s.toLowerCase().includes(q);
    return [
      ...actions.filter((a) => match(a.label)).map((a) => ({ ...a, kind: 'action' })),
      ...courses.filter((c) => match(c.title)).slice(0, 7).map((c) => ({
        id: `c-${c.id}`, label: c.title, hint: 'Corso', icon: BookOpen, kind: 'course',
        run: () => navigate(`/course/${c.id}`),
      })),
      ...labs.filter((c) => match(c.title || c.topic)).slice(0, 7).map((c) => ({
        id: `l-${c.id}`, label: c.title || c.topic, hint: 'Lab', icon: FlaskConical, kind: 'lab',
        run: () => navigate(`/labs/${c.id}`),
      })),
    ];
  }, [query, courses, labs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setActive(0), [query ]);

  if (!open) return null;

  const go = (item) => { setOpen(false); item.run(); };

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center bg-black/50 p-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comandi rapidi"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && items[active]) go(items[active]);
        }}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca corsi, lab, azioni…"
            className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-gray-400 dark:text-gray-100"
          />
          <kbd className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 font-mono text-[11px] text-gray-400 dark:border-gray-600">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-400">Niente trovato.</p>}
          {items.map((item, i) => (
            <button
              key={item.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(item)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                i === active ? 'bg-primary/10 text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'
              )}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', i === active ? 'text-primary' : 'text-gray-400')} />
              <span className="flex-1 truncate font-medium">{item.label}</span>
              <span className="text-xs text-gray-400">{item.hint}</span>
              {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-gray-400" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-gray-200 px-4 py-2.5 text-xs text-gray-400 dark:border-gray-700">
          <span><kbd className="font-mono">↑↓</kbd> naviga</span>
          <span><kbd className="font-mono">↵</kbd> apri</span>
          <span><kbd className="font-mono">⌘K</kbd> chiudi</span>
        </div>
      </div>
    </div>
  );
}
