// Types mirror the response models of sprint-planner-api.

export type Role = 'owner' | 'member';
export type SprintStatus = 'planned' | 'active' | 'completed';
export type StoryStatus = 'todo' | 'in_progress' | 'done';

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface Team {
  id: number;
  name: string;
}

export interface TeamDetail extends Team {
  members: { user: User; role: Role }[];
}

export interface Sprint {
  id: number;
  team_id: number;
  name: string;
  goal: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  capacity: number | null;
  status: SprintStatus;
  committed_points: number;
  completed_points: number;
}

export interface Story {
  id: number;
  team_id: number;
  sprint_id: number | null;
  title: string;
  description: string;
  points: number;
  status: StoryStatus;
  assignee_id: number | null;
  completed_on: string | null;
}

export interface BurndownDay {
  date: string;
  ideal: number;
  remaining: number | null;
}

export interface Burndown {
  sprint_id: number;
  committed_points: number;
  days: BurndownDay[];
}

export interface Velocity {
  sprints: { sprint_id: number; name: string; committed: number; completed: number }[];
  average: number;
  forecast_next: number;
}

export type NewSprint = Pick<Sprint, 'name' | 'goal' | 'start_date' | 'end_date' | 'capacity'>;
export type NewStory = Pick<Story, 'title' | 'description' | 'points' | 'assignee_id' | 'sprint_id'>;
export type StoryChanges = Partial<Pick<Story, 'title' | 'description' | 'points' | 'status' | 'assignee_id' | 'sprint_id'>>;

/** Everything the UI needs from a backend. Implemented by the real HTTP client and the in-browser demo. */
export interface Api {
  readonly mode: 'live' | 'demo';
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): void;
  isLoggedIn(): boolean;
  me(): Promise<User>;

  teams(): Promise<Team[]>;
  team(id: number): Promise<TeamDetail>;
  createTeam(name: string): Promise<TeamDetail>;
  addMember(teamId: number, email: string): Promise<TeamDetail>;

  sprints(teamId: number): Promise<Sprint[]>;
  createSprint(teamId: number, body: NewSprint): Promise<Sprint>;
  startSprint(id: number): Promise<Sprint>;
  completeSprint(id: number): Promise<Sprint>;
  burndown(sprintId: number): Promise<Burndown>;
  velocity(teamId: number): Promise<Velocity>;

  stories(teamId: number): Promise<Story[]>;
  createStory(teamId: number, body: NewStory, force?: boolean): Promise<Story>;
  updateStory(id: number, changes: StoryChanges, force?: boolean): Promise<Story>;
  deleteStory(id: number): Promise<void>;
}

/** Error carrying the HTTP status and the API's own message, e.g. 409 "Over capacity…" */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
