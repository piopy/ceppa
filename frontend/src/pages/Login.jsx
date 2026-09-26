import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout, { authInput, authButton } from '../components/AuthLayout';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError('Accesso non riuscito. Controlla le credenziali.');
    }
  };

  return (
    <AuthLayout
      title="Bentornato"
      subtitle="Riprendi da dove avevi lasciato."
      error={error}
      footer={<>Non hai un account? <Link to="/register" className="font-semibold text-primary hover:underline">Registrati</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-user" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
          <input id="login-user" type="text" value={username} onChange={e => setUsername(e.target.value)}
            autoComplete="username" required className={authInput} />
        </div>
        <div>
          <label htmlFor="login-pass" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
          <input id="login-pass" type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" required className={authInput} />
        </div>
        <button type="submit" className={authButton}>Accedi</button>
      </form>
    </AuthLayout>
  );
}
