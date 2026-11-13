import { HttpApi } from './http';
import { ApiError } from './types';

function fakeFetch(responses: Record<string, { status: number; body?: unknown }>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const key = `${init.method ?? 'GET'} ${url}`;
    const r = responses[key] ?? { status: 404, body: { detail: 'Not found' } };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe('HttpApi', () => {
  it('logs in with the OAuth2 form and sends the bearer token afterwards', async () => {
    const { fn, calls } = fakeFetch({
      'POST http://api.test/auth/login': { status: 200, body: { access_token: 'tok123', token_type: 'bearer' } },
      'GET http://api.test/teams': { status: 200, body: [{ id: 1, name: 'Web Team' }] },
    });
    const api = new HttpApi('http://api.test/', fn);
    await api.login('me@example.com', 'password123');
    expect(String(calls[0].init.body)).toBe('username=me%40example.com&password=password123');
    expect(await api.teams()).toEqual([{ id: 1, name: 'Web Team' }]);
    expect(new Headers(calls[1].init.headers).get('Authorization')).toBe('Bearer tok123');
    expect(api.isLoggedIn()).toBe(true);
  });

  it('surfaces the API error message and status', async () => {
    const { fn } = fakeFetch({
      'POST http://api.test/teams/1/stories': { status: 409, body: { detail: 'Over capacity: sprint has 20/20 points' } },
    });
    const api = new HttpApi('http://api.test', fn);
    const err = await api.createStory(1, { title: 'x', description: '', points: 3, assignee_id: null, sprint_id: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.message).toMatch(/Over capacity/);
  });

  it('joins FastAPI validation errors and adds ?force=true when overriding', async () => {
    const { fn, calls } = fakeFetch({
      'PATCH http://api.test/stories/5?force=true': { status: 422, body: { detail: [{ msg: 'points too high' }, { msg: 'bad status' }] } },
    });
    const api = new HttpApi('http://api.test', fn);
    await expect(api.updateStory(5, { points: 500 }, true)).rejects.toThrow('points too high; bad status');
    expect(new Headers(calls[0].init.headers).get('Content-Type')).toBe('application/json');
  });

  it('signs out automatically when the token expires', async () => {
    localStorage.setItem('sprint-dashboard-token', 'old');
    const { fn } = fakeFetch({ 'GET http://api.test/auth/me': { status: 401, body: { detail: 'Invalid or expired token' } } });
    const api = new HttpApi('http://api.test', fn);
    expect(api.isLoggedIn()).toBe(true);
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(api.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('sprint-dashboard-token')).toBeNull();
  });
});
