import { ApiError, type Api, type NewSprint, type NewStory, type StoryChanges } from './types';
import type { Burndown, Sprint, Story, Team, TeamDetail, User, Velocity } from './types';
import { addDays, daysBetween, isoDate } from '../lib/dates';

/**
 * A complete in-browser stand-in for sprint-planner-api, so the dashboard can be tried
 * (and hosted on GitHub Pages) with no server. It enforces the same Scrum rules as the API.
 */

interface DemoState {
  users: (User & { password: string })[];
  teams: { id: number; name: string; members: { userId: number; role: 'owner' | 'member' }[] }[];
  // committed_at_close keeps a finished sprint's original commitment after unfinished work leaves it
  sprints: (Omit<Sprint, 'committed_points' | 'completed_points'> & { committed_at_close?: number })[];
  stories: Story[];
  currentUser: number | null;
  nextId: number;
}

const STORAGE_KEY = 'sprint-dashboard-demo';

export function seedState(today = new Date()): DemoState {
  const t = isoDate(today);
  let id = 100;
  const next = () => ++id;
  const users = [
    { id: 1, email: 'demo@example.com', name: 'Demo User', password: 'password123' },
    { id: 2, email: 'amara@example.com', name: 'Amara Okafor', password: 'x' },
    { id: 3, email: 'liam@example.com', name: 'Liam Hughes', password: 'x' },
    { id: 4, email: 'sophie@example.com', name: 'Sophie Chen', password: 'x' },
  ];
  const team = { id: 1, name: 'Web Team', members: [{ userId: 1, role: 'owner' as const }, { userId: 2, role: 'member' as const }, { userId: 3, role: 'member' as const }, { userId: 4, role: 'member' as const }] };

  const sprints: DemoState['sprints'] = [];
  const stories: Story[] = [];
  const story = (s: Partial<Story> & Pick<Story, 'title' | 'points'>): Story => ({
    id: next(), team_id: 1, sprint_id: null, description: '', status: 'todo', assignee_id: null, completed_on: null, ...s,
  });

  // Four finished two-week sprints, for velocity
  const history = [[26, 21], [28, 27], [30, 24], [27, 29]] as const;
  history.forEach(([committed, completed], i) => {
    const start = addDays(t, -14 * (4 - i) - 4);
    const sid = next();
    sprints.push({ id: sid, team_id: 1, name: `Sprint ${i + 1}`, goal: '', start_date: start, end_date: addDays(start, 11), capacity: 30, status: 'completed', committed_at_close: Math.max(committed, completed) });
    stories.push(story({ title: `Sprint ${i + 1} delivered work`, points: completed, sprint_id: sid, status: 'done', completed_on: addDays(start, 10) }));
  });

  // The active sprint: started 4 days ago, 2 weeks long
  const activeStart = addDays(t, -4);
  const active = next();
  sprints.push({ id: active, team_id: 1, name: 'Sprint 5', goal: 'Launch online booking for trade clients', start_date: activeStart, end_date: addDays(activeStart, 11), capacity: 30, status: 'active' });
  stories.push(
    story({ title: 'Booking form with live time slots', points: 5, sprint_id: active, status: 'done', assignee_id: 2, completed_on: addDays(activeStart, 1) }),
    story({ title: 'Customer confirmation emails', points: 3, sprint_id: active, status: 'done', assignee_id: 3, completed_on: addDays(activeStart, 3) }),
    story({ title: 'Admin dashboard: today’s jobs', points: 5, sprint_id: active, status: 'in_progress', assignee_id: 1 }),
    story({ title: 'Prevent double bookings', points: 3, sprint_id: active, status: 'in_progress', assignee_id: 4 }),
    story({ title: 'Quote builder with VAT', points: 8, sprint_id: active, status: 'todo', assignee_id: 2 }),
    story({ title: 'Invoice PDF / print view', points: 3, sprint_id: active, status: 'todo' }),
  );

  const planned = next();
  sprints.push({ id: planned, team_id: 1, name: 'Sprint 6', goal: 'Payments and reminders', start_date: addDays(activeStart, 14), end_date: addDays(activeStart, 25), capacity: 30, status: 'planned' });
  stories.push(
    story({ title: 'Stripe card payments on invoices', points: 8, sprint_id: planned }),
    story({ title: 'SMS reminders the day before', points: 5 }),
    story({ title: 'Customer self-service reschedule link', points: 5 }),
    story({ title: 'Google reviews request after job', points: 2 }),
    story({ title: 'Accessibility audit of booking flow', points: 3 }),
    story({ title: 'Tidy up booking API error messages', points: 6 }),
  );
  return { users, teams: [team], sprints, stories, currentUser: null, nextId: id + 1 };
}

export class DemoApi implements Api {
  readonly mode = 'demo' as const;
  private state: DemoState;

  constructor(private readonly today: () => Date = () => new Date(), persist = true) {
    this.persist = persist;
    this.state = (persist && this.load()) || seedState(today());
  }

  private persist: boolean;

  private load(): DemoState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DemoState) : null;
    } catch {
      return null;
    }
  }

  private save() {
    if (!this.persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* storage full or unavailable: demo keeps working in memory */
    }
  }

  /** Small delay so loading states are visible, like a real network. */
  private async ok<T>(value: T): Promise<T> {
    this.save();
    await new Promise((r) => setTimeout(r, 0));
    return structuredClone(value);
  }

  private id() {
    return this.state.nextId++;
  }

  private requireUser(): number {
    if (this.state.currentUser === null) throw new ApiError(401, 'Please sign in');
    return this.state.currentUser;
  }

  private teamFor(teamId: number) {
    const uid = this.requireUser();
    const team = this.state.teams.find((t) => t.id === teamId);
    if (!team || !team.members.some((m) => m.userId === uid)) throw new ApiError(404, 'Team not found');
    return team;
  }

  private sprintFor(id: number) {
    const sprint = this.state.sprints.find((s) => s.id === id);
    if (!sprint) throw new ApiError(404, 'Sprint not found');
    this.teamFor(sprint.team_id);
    return sprint;
  }

  private withPoints(s: DemoState['sprints'][number]): Sprint {
    const items = this.state.stories.filter((st) => st.sprint_id === s.id);
    const { committed_at_close, ...sprint } = s;
    return {
      ...sprint,
      committed_points: committed_at_close ?? items.reduce((a, b) => a + b.points, 0),
      completed_points: items.filter((x) => x.status === 'done').reduce((a, b) => a + b.points, 0),
    };
  }

  private detail(team: DemoState['teams'][number]): TeamDetail {
    return {
      id: team.id,
      name: team.name,
      members: team.members.map((m) => {
        const { password: _pw, ...user } = this.state.users.find((u) => u.id === m.userId)!;
        void _pw;
        return { user, role: m.role };
      }),
    };
  }

  private checkCapacity(sprintId: number | null, extra: number, force: boolean) {
    if (sprintId === null) return;
    const sprint = this.sprintFor(sprintId);
    if (sprint.status === 'completed') throw new ApiError(409, 'Cannot add stories to a completed sprint');
    if (sprint.capacity !== null && !force) {
      const committed = this.withPoints(sprint).committed_points;
      if (committed + extra > sprint.capacity) {
        throw new ApiError(409, `Over capacity: sprint has ${committed}/${sprint.capacity} points committed; adding ${extra} would exceed it.`);
      }
    }
  }

  // ---------- auth ----------
  async login(email: string, password: string) {
    const user = this.state.users.find((u) => u.email === email.trim().toLowerCase() && u.password === password);
    if (!user) throw new ApiError(401, 'Incorrect email or password');
    this.state.currentUser = user.id;
    this.save();
  }

  async register(name: string, email: string, password: string) {
    const clean = email.trim().toLowerCase();
    if (password.length < 8) throw new ApiError(422, 'Password must be at least 8 characters');
    if (this.state.users.some((u) => u.email === clean)) throw new ApiError(409, 'An account with this email already exists');
    const user = { id: this.id(), email: clean, name: name.trim(), password };
    this.state.users.push(user);
    this.state.teams[0]?.members.push({ userId: user.id, role: 'owner' }); // let new demo users explore the sample team
    this.state.currentUser = user.id;
    this.save();
  }

  logout() {
    this.state.currentUser = null;
    this.save();
  }

  isLoggedIn() {
    return this.state.currentUser !== null;
  }

  async me() {
    const { password: _pw, ...user } = this.state.users.find((u) => u.id === this.requireUser())!;
    void _pw;
    return this.ok(user);
  }

  // ---------- teams ----------
  async teams(): Promise<Team[]> {
    const uid = this.requireUser();
    return this.ok(this.state.teams.filter((t) => t.members.some((m) => m.userId === uid)).map(({ id, name }) => ({ id, name })));
  }

  async team(id: number) {
    return this.ok(this.detail(this.teamFor(id)));
  }

  async createTeam(name: string) {
    const team = { id: this.id(), name: name.trim(), members: [{ userId: this.requireUser(), role: 'owner' as const }] };
    this.state.teams.push(team);
    return this.ok(this.detail(team));
  }

  async addMember(teamId: number, email: string) {
    const team = this.teamFor(teamId);
    const me = team.members.find((m) => m.userId === this.state.currentUser);
    if (me?.role !== 'owner') throw new ApiError(403, 'Only team owners can do this');
    const user = this.state.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user) throw new ApiError(404, 'No user with that email; ask them to register first');
    if (team.members.some((m) => m.userId === user.id)) throw new ApiError(409, 'User is already a member');
    team.members.push({ userId: user.id, role: 'member' });
    return this.ok(this.detail(team));
  }

  // ---------- sprints ----------
  async sprints(teamId: number) {
    this.teamFor(teamId);
    const list = this.state.sprints.filter((s) => s.team_id === teamId).sort((a, b) => a.start_date.localeCompare(b.start_date));
    return this.ok(list.map((s) => this.withPoints(s)));
  }

  async createSprint(teamId: number, body: NewSprint) {
    this.teamFor(teamId);
    if (!body.name.trim()) throw new ApiError(422, 'Sprint name is required');
    if (body.end_date < body.start_date) throw new ApiError(422, 'end_date must be on or after start_date');
    const sprint = { ...body, id: this.id(), team_id: teamId, status: 'planned' as const };
    this.state.sprints.push(sprint);
    return this.ok(this.withPoints(sprint));
  }

  async startSprint(id: number) {
    const sprint = this.sprintFor(id);
    if (sprint.status !== 'planned') throw new ApiError(409, `Sprint is already ${sprint.status}`);
    const active = this.state.sprints.find((s) => s.team_id === sprint.team_id && s.status === 'active');
    if (active) throw new ApiError(409, `Finish '${active.name}' before starting another sprint`);
    if (!this.state.stories.some((s) => s.sprint_id === id)) throw new ApiError(409, 'Add stories to the sprint before starting it');
    sprint.status = 'active';
    return this.ok(this.withPoints(sprint));
  }

  async completeSprint(id: number) {
    const sprint = this.sprintFor(id);
    if (sprint.status !== 'active') throw new ApiError(409, 'Only an active sprint can be completed');
    sprint.committed_at_close = this.withPoints(sprint).committed_points;
    for (const s of this.state.stories) {
      if (s.sprint_id === id && s.status !== 'done') {
        s.sprint_id = null;
        s.status = 'todo';
      }
    }
    sprint.status = 'completed';
    return this.ok(this.withPoints(sprint));
  }

  async burndown(sprintId: number): Promise<Burndown> {
    const sprint = this.sprintFor(sprintId);
    const items = this.state.stories.filter((s) => s.sprint_id === sprintId);
    const committed = this.withPoints(sprint).committed_points;
    const total = daysBetween(sprint.start_date, sprint.end_date);
    const today = isoDate(this.today());
    const days = Array.from({ length: total + 1 }, (_, i) => {
      const date = addDays(sprint.start_date, i);
      const done = items.filter((s) => s.completed_on && s.completed_on <= date).reduce((a, b) => a + b.points, 0);
      return {
        date,
        ideal: Math.round((total ? committed * (1 - i / total) : 0) * 100) / 100,
        remaining: date > today && sprint.status !== 'completed' ? null : committed - done,
      };
    });
    return this.ok({ sprint_id: sprintId, committed_points: committed, days });
  }

  async velocity(teamId: number): Promise<Velocity> {
    this.teamFor(teamId);
    const done = this.state.sprints
      .filter((s) => s.team_id === teamId && s.status === 'completed')
      .sort((a, b) => a.end_date.localeCompare(b.end_date))
      .map((s) => {
        const p = this.withPoints(s);
        return { sprint_id: s.id, name: s.name, committed: p.committed_points, completed: p.completed_points };
      });
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
    return this.ok({ sprints: done, average: avg(done.map((d) => d.completed)), forecast_next: avg(done.slice(-3).map((d) => d.completed)) });
  }

  // ---------- stories ----------
  async stories(teamId: number) {
    this.teamFor(teamId);
    return this.ok(this.state.stories.filter((s) => s.team_id === teamId));
  }

  async createStory(teamId: number, body: NewStory, force = false) {
    this.teamFor(teamId);
    if (!body.title.trim()) throw new ApiError(422, 'Title is required');
    this.checkCapacity(body.sprint_id, body.points, force);
    const story: Story = { ...body, id: this.id(), team_id: teamId, status: 'todo', completed_on: null };
    this.state.stories.push(story);
    return this.ok(story);
  }

  async updateStory(id: number, changes: StoryChanges, force = false) {
    const story = this.state.stories.find((s) => s.id === id);
    if (!story) throw new ApiError(404, 'Story not found');
    this.teamFor(story.team_id);
    if ('sprint_id' in changes && changes.sprint_id !== story.sprint_id) {
      this.checkCapacity(changes.sprint_id ?? null, changes.points ?? story.points, force);
    } else if (changes.points !== undefined && story.sprint_id !== null) {
      this.checkCapacity(story.sprint_id, changes.points - story.points, force);
    }
    if (changes.status && changes.status !== story.status) {
      story.completed_on = changes.status === 'done' ? isoDate(this.today()) : null;
    }
    Object.assign(story, changes);
    return this.ok(story);
  }

  async deleteStory(id: number) {
    const story = this.state.stories.find((s) => s.id === id);
    if (!story) throw new ApiError(404, 'Story not found');
    this.teamFor(story.team_id);
    this.state.stories = this.state.stories.filter((s) => s.id !== id);
    await this.ok(null);
  }

  /** Start the demo again from the sample data. */
  reset() {
    this.state = seedState(this.today());
    this.save();
  }
}
