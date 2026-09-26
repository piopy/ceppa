import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Book, PlusCircle, Home, Github, ChevronLeft, ChevronRight, Moon, Sun, Settings, FlaskConical, Map, Flame, Search } from 'lucide-react';
import versionData from '../version.json';
import CommandPalette from './CommandPalette';
import { useState, useEffect } from 'react';

export default function Layout() {
  const { user, logout, streak } = useAuth();
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    // localStorage vince; altrimenti prefers-color-scheme
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  // Apply dark mode class to document on mount and when it changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Listen for immersive mode changes from CourseView
  useEffect(() => {
    const handleStorageChange = () => {
      const immersiveMode = localStorage.getItem('immersiveMode') === 'true';
      setShowSidebar(!immersiveMode);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('immersiveModeChange', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('immersiveModeChange', handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100">
      {/* Toggle Button for Sidebar */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-30 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded-r-lg border border-gray-200 dark:border-gray-700 transition shadow-md"
        style={{ left: showSidebar ? '256px' : '0' }}
        title={showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
      >
        {showSidebar ? (
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        )}
      </button>
      
      {/* Sidebar */}
      <aside className={`bg-secondary dark:bg-gray-800 text-white flex flex-col shadow-xl transition-all duration-300 ${
        showSidebar ? 'w-64' : 'w-0'
      } overflow-hidden`}>
        <div className="p-5 pb-2">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Book className="w-6 h-6 text-primary" />
            Ceppa.ai
          </h1>
          {streak && streak.streak > 0 && (
            <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2" title={`${streak.total_days} giorni di attività totali`}>
              <Flame className={`h-4 w-4 ${streak.today_done ? 'fill-orange-500 text-orange-500' : 'text-white/40'}`} />
              <span className="tabular text-sm font-bold text-white">{streak.streak}</span>
              <span className="text-xs text-white/60">{streak.streak === 1 ? 'giorno' : 'giorni'}</span>
            </div>
          )}
          <button
            onClick={() => window.dispatchEvent(new Event('ceppa-palette'))}
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Cerca…</span>
            <kbd className="rounded border border-white/20 px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
        </div>
        
        <nav aria-label="Principale" className="flex-1 px-3 space-y-1 mt-3 text-[15px]">
          <NavLink to="/" end className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
            <Home className="w-5 h-5" />
            Dashboard
          </NavLink>
          <NavLink to="/labs" className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
            <FlaskConical className="w-5 h-5 text-orange-400" />
            Hands-on Labs
          </NavLink>
          <NavLink to="/roadmaps" className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
            <Map className="w-5 h-5 text-emerald-400" />
            Roadmaps
          </NavLink>
        </nav>


        <div className="px-4 py-3">
          <p className="text-xs text-white/60 px-4 py-2 text-center">v{versionData.version}</p>
          <a 
            href="https://github.com/piopy/ceppa" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/10 transition"
          >
            <Github className="w-5 h-5" />
            <span className="text-sm font-medium">View on GitHub</span>
          </a>
        </div>

        <div className="p-4 border-t border-white/10 dark:border-white/5">
          <div className="flex items-center gap-3 px-4 py-3">
             <Link to="/profile" className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold hover:ring-2 hover:ring-white/40 transition" title="Profile Settings">
               {user?.username?.[0]?.toUpperCase()}
             </Link>
             <div className="flex-1 overflow-hidden">
               <Link to="/profile" className="text-sm font-medium truncate hover:underline block">{user?.username}</Link>
             </div>
             <button
               onClick={() => setDarkMode(!darkMode)}
               className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition"
               title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
             >
               {darkMode ? (
                 <Sun className="w-5 h-5 text-yellow-400" />
               ) : (
                 <Moon className="w-5 h-5 text-gray-300" />
               )}
             </button>
          </div>
          <Link
            to="/profile"
            className="w-full flex items-center gap-3 px-4 py-3 mt-1 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition text-white/80"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 mt-1 rounded-lg hover:bg-red-500/20 dark:hover:bg-red-500/10 text-red-400 transition"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  );
}
