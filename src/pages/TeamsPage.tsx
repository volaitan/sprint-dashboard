import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../api/client';
import { useToast } from '../components/Toast';

export function TeamsPage() {
  const api = useApi();
  const navigate = useNavigate();
  const notify = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const { data: teams, isLoading, error } = useQuery({ queryKey: ['teams'], queryFn: () => api.teams() });

  const create = useMutation({
    mutationFn: (teamName: string) => api.createTeam(teamName),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      navigate(`/teams/${team.id}`);
    },
    onError: (e: Error) => notify(e.message, { tone: 'error' }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate(name.trim());
  };

  return (
    <section>
      <h1>Your teams</h1>
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      <div className="team-grid">
        {teams?.map((t) => (
          <Link key={t.id} to={`/teams/${t.id}`} className="card team-card">
            <strong>{t.name}</strong>
            <span className="muted">Open board →</span>
          </Link>
        ))}
        <form className="card team-card new-team" onSubmit={submit}>
          <label>New team<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile Squad" /></label>
          <button className="btn btn-small" disabled={!name.trim() || create.isPending}>Create team</button>
        </form>
      </div>
    </section>
  );
}
