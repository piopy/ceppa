import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout, { authInput, authButton } from '../components/AuthLayout';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(username, password);
      navigate('/');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join('; ')
        : detail;
      if (msg && msg.toLowerCase().includes('already exists')) {
        setError('Username già in uso. Scegline un altro.');
      } else if (msg) {
        setError(`Registrazione non riuscita: ${msg}`);
      } else {
        setError('Registrazione non riuscita. Riprova più tardi.');
      }
    }
  };

  return (
    <AuthLayout
      title="Crea il tuo account"
      subtitle="Gratis, senza carta. I tuoi corsi restano tuoi."
      error={error}
      footer={<>Hai già un account? <Link to="/login" className="font-semibold text-primary hover:underline">Accedi</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reg-user" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
          <input id="reg-user" type="text" value={username} onChange={e => setUsername(e.target.value)}
            autoComplete="username" required className={authInput} />
        </div>
        <div>
          <label htmlFor="reg-pass" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
          <input id="reg-pass" type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="new-password" required minLength={8} title="Minimo 8 caratteri" className={authInput} />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Minimo 8 caratteri.</p>
        </div>
        <button type="submit" className={authButton}>Crea account</button>
      </form>
    </AuthLayout>
  );
}
