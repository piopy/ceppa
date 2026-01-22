import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError('Login failed. Check credentials.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold text-center mb-8 text-primary">Ceppa.ai</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              className="mt-1 w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="mt-1 w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              required
            />
          </div>
          <button type="submit" className="w-full py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition">
            Sign In
          </button>
        </form>
        <p className="mt-4 text-center text-sm dark:text-gray-400">
          Don't have an account? <Link to="/register" className="text-primary hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
