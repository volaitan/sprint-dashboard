import { ApiError, type Api, type NewSprint, type NewStory, type StoryChanges } from './types';
import type { Burndown, Sprint, Story, Team, TeamDetail, User, Velocity } from './types';

const TOKEN_KEY = 'sprint-dashboard-token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: token lives only in memory */
  }
}

/** Talks to a running sprint-planner-api over HTTP with a JWT bearer token. */
export class HttpApi implements Api {
  readonly mode = 'live' as const;
  private token: string | null = readToken();

  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch.bind(globalThis)) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    if (init.body && !(init.body instanceof URLSearchParams)) headers.set('Content-Type', 'application/json');

    const res = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}${path}`, { ...init, headers });
    if (res.status === 401 && this.token) {
      this.logout(); // expired session: send the user back to the login screen
    }
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (typeof body.detail === 'string') message = body.detail;
        else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join('; ');
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, message);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  private json(method: string, body: unknown): RequestInit {
    return { method, body: JSON.stringify(body) };
  }

  async login(email: string, password: string) {
    const form = new URLSearchParams({ username: email, password });
    const { access_token } = await this.request<{ access_token: string }>('/auth/login', { method: 'POST', body: form });
    this.token = access_token;
    writeToken(access_token);
  }

  async register(name: string, email: string, password: string) {
    await this.request('/auth/register', this.json('POST', { name, email, password }));
    await this.login(email, password);
  }

  logout() {
    this.token = null;
    writeToken(null);
  }

  isLoggedIn() {
    return this.token !== null;
  }

  me = () => this.request<User>('/auth/me');
  teams = () => this.request<Team[]>('/teams');
  team = (id: number) => this.request<TeamDetail>(`/teams/${id}`);
  createTeam = (name: string) => this.request<TeamDetail>('/teams', this.json('POST', { name }));
  addMember = (teamId: number, email: string) => this.request<TeamDetail>(`/teams/${teamId}/members`, this.json('POST', { email }));

  sprints = (teamId: number) => this.request<Sprint[]>(`/teams/${teamId}/sprints`);
  createSprint = (teamId: number, body: NewSprint) => this.request<Sprint>(`/teams/${teamId}/sprints`, this.json('POST', body));
  startSprint = (id: number) => this.request<Sprint>(`/sprints/${id}/start`, { method: 'POST' });
  completeSprint = (id: number) => this.request<Sprint>(`/sprints/${id}/complete`, { method: 'POST' });
  burndown = (sprintId: number) => this.request<Burndown>(`/sprints/${sprintId}/burndown`);
  velocity = (teamId: number) => this.request<Velocity>(`/teams/${teamId}/velocity`);

  stories = (teamId: number) => this.request<Story[]>(`/teams/${teamId}/stories`);
  createStory = (teamId: number, body: NewStory, force = false) =>
    this.request<Story>(`/teams/${teamId}/stories${force ? '?force=true' : ''}`, this.json('POST', body));
  updateStory = (id: number, changes: StoryChanges, force = false) =>
    this.request<Story>(`/stories/${id}${force ? '?force=true' : ''}`, this.json('PATCH', changes));
  deleteStory = (id: number) => this.request<void>(`/stories/${id}`, { method: 'DELETE' });
}
