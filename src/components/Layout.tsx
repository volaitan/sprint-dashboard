import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useApi } from '../api/client';
import { DemoApi } from '../api/demo';

export function Layout() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.me() });

  const logout = () => {
    api.logout();
    queryClient.clear();
    navigate('/login');
  };

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link to="/" className="brand">📈 Sprint Dashboard</Link>
          <div className="topbar-right">
            {api.mode === 'demo' && (
              <span className="badge" title="Data lives in your browser; nothing is sent to a server">Demo mode</span>
            )}
            {api instanceof DemoApi && (
              <button className="link" onClick={() => { api.reset(); queryClient.clear(); navigate('/login'); }}>Reset demo</button>
            )}
            {me && <span className="muted">{me.name}</span>}
            <button className="link" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="wrap">
        <Outlet />
      </main>
    </>
  );
}
