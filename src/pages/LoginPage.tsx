import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../api/client';

export function LoginPage() {
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(api.mode === 'demo' ? 'demo@example.com' : '');
  const [password, setPassword] = useState(api.mode === 'demo' ? 'password123' : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await api.login(email, password);
      else await api.register(name, email, password);
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="card auth-card" onSubmit={submit}>
        <h1>📈 Sprint Dashboard</h1>
        <p className="muted">{mode === 'login' ? 'Sign in to plan your sprints.' : 'Create an account.'}</p>
        {api.mode === 'demo' && (
          <p className="hint">Demo mode: the sample login is filled in for you. Everything runs in your browser.</p>
        )}
        {mode === 'register' && (
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>
        )}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
