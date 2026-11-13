import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../api/client';
import type { Sprint, Story } from '../api/types';
import { Board } from '../components/Board';
import { BurndownChart, VelocityChart } from '../components/Charts';
import { SprintForm, StoryForm } from '../components/Forms';
import { useToast } from '../components/Toast';
import { daysBetween, isoDate, shortDate } from '../lib/dates';
import { useStoryMutations } from '../lib/useStoryMutations';

function defaultSprint(sprints: Sprint[]): Sprint | undefined {
  return sprints.find((s) => s.status === 'active') ?? sprints.find((s) => s.status === 'planned') ?? sprints[sprints.length - 1];
}

export function TeamPage() {
  const teamId = Number(useParams().teamId);
  const api = useApi();
  const notify = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');

  const team = useQuery({ queryKey: ['team', teamId], queryFn: () => api.team(teamId) });
  const sprints = useQuery({ queryKey: ['sprints', teamId], queryFn: () => api.sprints(teamId) });
  const stories = useQuery({ queryKey: ['stories', teamId], queryFn: () => api.stories(teamId) });
  const velocity = useQuery({ queryKey: ['velocity', teamId], queryFn: () => api.velocity(teamId) });

  useEffect(() => {
    if (selectedId === null && sprints.data?.length) setSelectedId(defaultSprint(sprints.data)?.id ?? null);
  }, [sprints.data, selectedId]);

  const sprint = sprints.data?.find((s) => s.id === selectedId);
  const burndown = useQuery({
    queryKey: ['burndown', selectedId],
    queryFn: () => api.burndown(selectedId!),
    enabled: selectedId !== null,
  });

  const members = useMemo(() => team.data?.members.map((m) => m.user) ?? [], [team.data]);
  const sprintStories = stories.data?.filter((s) => s.sprint_id === selectedId) ?? [];
  const backlog = stories.data?.filter((s) => s.sprint_id === null) ?? [];
  const { update, create, remove } = useStoryMutations(teamId);

  const refreshAll = () => {
    for (const key of ['sprints', 'stories', 'velocity']) queryClient.invalidateQueries({ queryKey: [key, teamId] });
    queryClient.invalidateQueries({ queryKey: ['burndown'] });
  };

  const lifecycle = useMutation({
    mutationFn: ({ action, id }: { action: 'start' | 'complete'; id: number }) =>
      action === 'start' ? api.startSprint(id) : api.completeSprint(id),
    onSuccess: (s, { action }) => {
      notify(action === 'start' ? `${s.name} started` : `${s.name} completed: ${s.completed_points} of ${s.committed_points} points delivered. Unfinished work went back to the backlog.`);
      refreshAll();
    },
    onError: (e: Error) => notify(e.message, { tone: 'error' }),
  });

  const newSprint = useMutation({
    mutationFn: (body: Parameters<typeof api.createSprint>[1]) => api.createSprint(teamId, body),
    onSuccess: (s) => { setShowSprintForm(false); setSelectedId(s.id); refreshAll(); notify(`${s.name} created`); },
    onError: (e: Error) => notify(e.message, { tone: 'error' }),
  });

  const addMember = useMutation({
    mutationFn: (email: string) => api.addMember(teamId, email),
    onSuccess: () => { setMemberEmail(''); queryClient.invalidateQueries({ queryKey: ['team', teamId] }); notify('Member added'); },
    onError: (e: Error) => notify(e.message, { tone: 'error' }),
  });

  if (team.isLoading || sprints.isLoading || stories.isLoading) return <p className="muted">Loading team…</p>;
  if (team.error) return <div className="card"><p className="error">{(team.error as Error).message}</p><Link to="/">Back to teams</Link></div>;

  const today = isoDate(new Date());
  const daysLeft = sprint && sprint.status === 'active' ? Math.max(0, daysBetween(today, sprint.end_date)) : null;
  const committed = sprintStories.reduce((a, s) => a + s.points, 0);
  const done = sprintStories.filter((s) => s.status === 'done').reduce((a, s) => a + s.points, 0);
  const readOnly = sprint?.status === 'completed';
  const pct = committed ? Math.round((100 * done) / committed) : 0;

  const moveToSprint = (story: Story) => {
    if (!sprint) return;
    update.mutate({ id: story.id, changes: { sprint_id: sprint.id } });
  };

  const submitMember = (e: FormEvent) => {
    e.preventDefault();
    if (memberEmail.trim()) addMember.mutate(memberEmail.trim());
  };

  return (
    <div className="team-page">
      <div className="page-head">
        <div>
          <Link to="/" className="muted small">← Teams</Link>
          <h1>{team.data?.name}</h1>
        </div>
        <div className="sprint-picker">
          <select aria-label="Sprint" value={selectedId ?? ''} onChange={(e) => setSelectedId(Number(e.target.value))}>
            {sprints.data?.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}
          </select>
          <button className="btn btn-ghost btn-small" onClick={() => setShowSprintForm((v) => !v)}>+ Sprint</button>
        </div>
      </div>

      {showSprintForm && (
        <SprintForm nextNumber={(sprints.data?.length ?? 0) + 1} busy={newSprint.isPending}
          onSubmit={(body) => newSprint.mutate(body)} onCancel={() => setShowSprintForm(false)} />
      )}

      {sprint ? (
        <>
          <div className="sprint-head card">
            <div>
              <h2>{sprint.name} <span className={`pill pill-${sprint.status}`}>{sprint.status}</span></h2>
              {sprint.goal && <p className="goal">🎯 {sprint.goal}</p>}
              <p className="muted small">{shortDate(sprint.start_date)} – {shortDate(sprint.end_date)}</p>
            </div>
            <div className="sprint-actions">
              {sprint.status === 'planned' && <button className="btn" onClick={() => lifecycle.mutate({ action: 'start', id: sprint.id })}>Start sprint</button>}
              {sprint.status === 'active' && <button className="btn" onClick={() => lifecycle.mutate({ action: 'complete', id: sprint.id })}>Complete sprint</button>}
            </div>
          </div>

          <div className="stats">
            <div className="stat"><span>{committed}{sprint.capacity !== null && <small>/{sprint.capacity}</small>}</span>points committed</div>
            <div className="stat"><span>{done}</span>points done</div>
            <div className="stat">
              <span>{pct}%</span>complete
              <div className="progress" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="stat"><span>{daysLeft ?? '—'}</span>days left</div>
            <div className="stat"><span>{velocity.data?.forecast_next ?? '—'}</span>forecast velocity</div>
          </div>

          <Board stories={sprintStories} members={members} readOnly={readOnly}
            onMove={(story, status) => update.mutate({ id: story.id, changes: { status } })}
            onRemoveFromSprint={(story) => update.mutate({ id: story.id, changes: { sprint_id: null } })} />
        </>
      ) : (
        <div className="card empty-state">
          <h2>No sprints yet</h2>
          <p>Create your first sprint, then add stories from the backlog.</p>
          <button className="btn" onClick={() => setShowSprintForm(true)}>Create sprint</button>
        </div>
      )}

      <div className="two-col">
        <section className="card">
          <h2>Burndown</h2>
          {burndown.data && burndown.data.committed_points > 0 ? <BurndownChart data={burndown.data} /> : <p className="muted">Add stories to this sprint to see the burndown.</p>}
        </section>
        <section className="card">
          <h2>Velocity</h2>
          {velocity.data && <VelocityChart data={velocity.data} />}
          {velocity.data && velocity.data.sprints.length > 0 && (
            <p className="muted small">Average {velocity.data.average} pts · next sprint forecast {velocity.data.forecast_next} pts (last 3 sprints)</p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="section-head">
          <h2>Backlog <span className="muted small">{backlog.length} stories · {backlog.reduce((a, s) => a + s.points, 0)} pts</span></h2>
        </div>
        <StoryForm members={members} sprintId={sprint && !readOnly ? sprint.id : null} busy={create.isPending}
          onSubmit={(body) => create.mutate({ body })} />
        <ul className="backlog">
          {backlog.map((s) => (
            <li key={s.id}>
              <span className="points">{s.points}</span>
              <span className="backlog-title">{s.title}</span>
              {sprint && !readOnly && <button className="btn btn-small btn-ghost" onClick={() => moveToSprint(s)}>Add to {sprint.name}</button>}
              <button className="icon-btn" aria-label={`Delete ${s.title}`} onClick={() => remove.mutate(s.id)}>🗑</button>
            </li>
          ))}
          {backlog.length === 0 && <li className="muted">The backlog is empty.</li>}
        </ul>
      </section>

      <section className="card">
        <h2>Team</h2>
        <ul className="members">
          {team.data?.members.map((m) => <li key={m.user.id}><strong>{m.user.name}</strong> <span className="muted small">{m.user.email} · {m.role}</span></li>)}
        </ul>
        {/* Only owners can add members; the API enforces this and explains if not. */}
        <form className="inline-form" onSubmit={submitMember}>
          <input type="email" aria-label="Member email" placeholder="colleague@example.com" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
          <button className="btn btn-small" disabled={!memberEmail.trim() || addMember.isPending}>Add member</button>
        </form>
      </section>
    </div>
  );
}
