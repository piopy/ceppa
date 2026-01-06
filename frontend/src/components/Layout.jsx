import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Book, PlusCircle, Home } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-secondary text-white flex flex-col shadow-xl">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Book className="w-8 h-8 text-primary" />
            Autolearn.ai
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition">
            <Home className="w-5 h-5" />
            Dashboard
          </Link>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
             <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold">
               {user?.username?.[0]?.toUpperCase()}
             </div>
             <div className="flex-1 overflow-hidden">
               <p className="text-sm font-medium truncate">{user?.username}</p>
             </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-lg hover:bg-red-500/20 text-red-400 transition"
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
