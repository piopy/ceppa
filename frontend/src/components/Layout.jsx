import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Book, PlusCircle, Home, Github, ChevronLeft, ChevronRight, Moon, Sun, Settings } from 'lucide-react';
import versionData from '../version.json';
import { useState, useEffect } from 'react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize from localStorage or default to false
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
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
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Book className="w-8 h-8 text-primary" />
            Ceppa.ai
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition">
            <Home className="w-5 h-5" />
            Dashboard
          </Link>
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
    </div>
  );
}
