import { DemoApi, seedState } from './demo';
import { ApiError } from './types';

const TODAY = new Date(2026, 10, 13); // 13 Nov 2026

async function signedIn() {
  const api = new DemoApi(() => TODAY, false);
  await api.login('demo@example.com', 'password123');
  return api;
}

async function activeSprint(api: DemoApi) {
  return (await api.sprints(1)).find((s) => s.status === 'active')!;
}

describe('DemoApi', () => {
  it('requires sign-in and rejects bad passwords', async () => {
    const api = new DemoApi(() => TODAY, false);
    await expect(api.teams()).rejects.toMatchObject({ status: 401 });
    await expect(api.login('demo@example.com', 'wrong')).rejects.toBeInstanceOf(ApiError);
    await api.login('DEMO@example.com ', 'password123');
    expect(api.isLoggedIn()).toBe(true);
    expect((await api.me()).name).toBe('Demo User');
  });

  it('seeds a believable team history', () => {
    const state = seedState(TODAY);
    expect(state.sprints.filter((s) => s.status === 'completed')).toHaveLength(4);
    expect(state.sprints.filter((s) => s.status === 'active')).toHaveLength(1);
    expect(state.stories.some((s) => s.sprint_id === null)).toBe(true);
  });

  it('enforces sprint capacity unless forced', async () => {
    const api = await signedIn();
    const sprint = await activeSprint(api); // 27 of 30 points committed
    const body = { title: 'Big story', description: '', points: 8, assignee_id: null, sprint_id: sprint.id };
    await expect(api.createStory(1, body)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Over capacity') });
    const story = await api.createStory(1, body, true);
    expect(story.sprint_id).toBe(sprint.id);
  });

  it('allows only one active sprint and no empty sprints', async () => {
    const api = await signedIn();
    const planned = (await api.sprints(1)).find((s) => s.status === 'planned')!;
    await expect(api.startSprint(planned.id)).rejects.toMatchObject({ message: expect.stringContaining('Finish') });
    const empty = await api.createSprint(1, { name: 'Empty', goal: '', start_date: '2026-12-01', end_date: '2026-12-12', capacity: null });
    await expect(api.startSprint(empty.id)).rejects.toMatchObject({ status: 409 });
  });

  it('records completion dates and burns down', async () => {
    const api = await signedIn();
    const sprint = await activeSprint(api);
    const todo = (await api.stories(1)).find((s) => s.sprint_id === sprint.id && s.status === 'todo')!;
    const before = await api.burndown(sprint.id);
    const updated = await api.updateStory(todo.id, { status: 'done' });
    expect(updated.completed_on).toBe('2026-11-13');
    const after = await api.burndown(sprint.id);
    const todayRow = (b: typeof after) => b.days.find((d) => d.date === '2026-11-13')!;
    expect(todayRow(after).remaining).toBe(todayRow(before).remaining! - todo.points);
    expect(after.days.at(-1)!.remaining).toBeNull(); // future days have no actual value
    expect(after.days[0].ideal).toBe(after.committed_points);
  });

  it('completing a sprint returns unfinished work to the backlog and keeps velocity honest', async () => {
    const api = await signedIn();
    const sprint = await activeSprint(api);
    const closed = await api.completeSprint(sprint.id);
    expect(closed.status).toBe('completed');
    expect(closed.committed_points).toBe(27);
    expect(closed.completed_points).toBe(8);

    const stories = await api.stories(1);
    expect(stories.filter((s) => s.sprint_id === sprint.id).every((s) => s.status === 'done')).toBe(true);

    const v = await api.velocity(1);
    expect(v.sprints.at(-1)).toMatchObject({ committed: 27, completed: 8 });
    expect(v.forecast_next).toBeCloseTo((24 + 29 + 8) / 3, 1);
  });

  it('hides other teams', async () => {
    const api = await signedIn();
    await api.register('Bob', 'bob@example.com', 'password123');
    const bobsTeam = await api.createTeam('Bob Team');
    await api.login('demo@example.com', 'password123');
    await expect(api.team(bobsTeam.id)).rejects.toMatchObject({ status: 404 });
  });
});
