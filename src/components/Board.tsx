import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import type { Story, StoryStatus, User } from '../api/types';

export const COLUMNS: { status: StoryStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
];

interface BoardProps {
  stories: Story[];
  members: User[];
  readOnly?: boolean;
  onMove: (story: Story, status: StoryStatus) => void;
  onRemoveFromSprint: (story: Story) => void;
}

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function Card({ story, assignee, readOnly, onMove, onRemoveFromSprint }: {
  story: Story; assignee?: User; readOnly?: boolean;
  onMove: BoardProps['onMove']; onRemoveFromSprint: BoardProps['onRemoveFromSprint'];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: story.id, disabled: readOnly });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const idx = COLUMNS.findIndex((c) => c.status === story.status);

  return (
    <article ref={setNodeRef} style={style} className={`story-card${isDragging ? ' dragging' : ''}`} data-testid={`story-${story.id}`}
      {...attributes} {...listeners} aria-label={`${story.title}, ${story.points} points`}>
      <div className="story-title">{story.title}</div>
      <div className="story-meta">
        <span className="points">{story.points} pts</span>
        {assignee ? <span className="avatar" title={assignee.name}>{initials(assignee.name)}</span> : <span className="muted small">Unassigned</span>}
      </div>
      {!readOnly && (
        // Buttons give keyboard and touch users a way to move cards without dragging.
        <div className="card-actions" onPointerDown={(e) => e.stopPropagation()}>
          {idx > 0 && <button className="icon-btn" aria-label={`Move ${story.title} back`} onClick={() => onMove(story, COLUMNS[idx - 1].status)}>←</button>}
          {idx < COLUMNS.length - 1 && <button className="icon-btn" aria-label={`Move ${story.title} forward`} onClick={() => onMove(story, COLUMNS[idx + 1].status)}>→</button>}
          {story.status !== 'done' && <button className="icon-btn" aria-label={`Move ${story.title} to backlog`} title="Back to backlog" onClick={() => onRemoveFromSprint(story)}>↩</button>}
        </div>
      )}
    </article>
  );
}

function Column({ status, label, children, total, points }: { status: StoryStatus; label: string; children: React.ReactNode; total: number; points: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`column${isOver ? ' over' : ''}`} aria-label={label}>
      <header className="column-head"><h3>{label}</h3><span className="count">{total} · {points} pts</span></header>
      <div className="column-body">{children}</div>
    </section>
  );
}

export function Board({ stories, members, readOnly, onMove, onRemoveFromSprint }: BoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const byId = new Map(members.map((m) => [m.id, m]));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const story = stories.find((s) => s.id === active.id);
    const status = over?.id as StoryStatus | undefined;
    if (story && status && status !== story.status) onMove(story, status);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="board">
        {COLUMNS.map((col) => {
          const items = stories.filter((s) => s.status === col.status);
          return (
            <Column key={col.status} {...col} total={items.length} points={items.reduce((a, b) => a + b.points, 0)}>
              {items.map((s) => (
                <Card key={s.id} story={s} assignee={s.assignee_id ? byId.get(s.assignee_id) : undefined}
                  readOnly={readOnly} onMove={onMove} onRemoveFromSprint={onRemoveFromSprint} />
              ))}
              {items.length === 0 && <p className="empty">Drop stories here</p>}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}
