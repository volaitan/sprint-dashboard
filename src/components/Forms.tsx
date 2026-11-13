import { useState, type FormEvent } from 'react';
import type { NewSprint, NewStory, User } from '../api/types';
import { addDays, isoDate } from '../lib/dates';

export function StoryForm({ members, sprintId, onSubmit, busy }: {
  members: User[]; sprintId: number | null; busy?: boolean; onSubmit: (story: NewStory) => void;
}) {
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState(3);
  const [assignee, setAssignee] = useState('');
  const [target, setTarget] = useState<'backlog' | 'sprint'>('backlog');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(), description: '', points,
      assignee_id: assignee ? Number(assignee) : null,
      sprint_id: target === 'sprint' ? sprintId : null,
    });
    setTitle('');
  };

  return (
    <form className="inline-form" onSubmit={submit} aria-label="Add a story">
      <input aria-label="Story title" placeholder="New story, e.g. Add password reset" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select aria-label="Story points" value={points} onChange={(e) => setPoints(Number(e.target.value))}>
        {[1, 2, 3, 5, 8, 13].map((p) => <option key={p} value={p}>{p} pts</option>)}
      </select>
      <select aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
        <option value="">Unassigned</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {sprintId !== null && (
        <select aria-label="Add to" value={target} onChange={(e) => setTarget(e.target.value as 'backlog' | 'sprint')}>
          <option value="backlog">Backlog</option>
          <option value="sprint">This sprint</option>
        </select>
      )}
      <button className="btn btn-small" disabled={!title.trim() || busy}>Add story</button>
    </form>
  );
}

export function SprintForm({ nextNumber, onSubmit, onCancel, busy }: {
  nextNumber: number; busy?: boolean; onSubmit: (sprint: NewSprint) => void; onCancel: () => void;
}) {
  const today = isoDate(new Date());
  const [name, setName] = useState(`Sprint ${nextNumber}`);
  const [goal, setGoal] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 11));
  const [capacity, setCapacity] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ name, goal, start_date: start, end_date: end, capacity: capacity ? Number(capacity) : null });
  };

  return (
    <form className="card form-grid" onSubmit={submit} aria-label="New sprint">
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Goal<input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What will this sprint achieve?" /></label>
      <label>Start<input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
      <label>End<input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required /></label>
      <label>Capacity (points)<input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Optional" /></label>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={onCancel}>Cancel</button>
        <button className="btn btn-small" disabled={busy}>Create sprint</button>
      </div>
    </form>
  );
}
