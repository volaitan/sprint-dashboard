import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { App } from './App';
import { DemoApi } from './api/demo';

function setup() {
  window.location.hash = '#/';
  const api = new DemoApi(() => new Date(2026, 10, 13), false);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<App api={api} queryClient={queryClient} />);
  return { api, user: userEvent.setup() };
}

async function openTeam(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Sign in' }));
  await user.click(await screen.findByText('Web Team'));
  await screen.findByRole('heading', { name: /Sprint 5/ });
}

describe('Sprint Dashboard', () => {
  it('redirects to sign-in, with the demo login pre-filled', async () => {
    setup();
    expect(await screen.findByText(/Demo mode/)).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('demo@example.com');
  });

  it('shows an error for a wrong password', async () => {
    const { user } = setup();
    const password = await screen.findByLabelText('Password');
    await user.clear(password);
    await user.type(password, 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
  });

  it('opens the active sprint board with stats and columns', async () => {
    const { user } = setup();
    await openTeam(user);
    expect(screen.getByText('Launch online booking for trade clients', { exact: false })).toBeInTheDocument();
    const todo = screen.getByRole('region', { name: 'To do' });
    expect(within(todo).getByText('Quote builder with VAT')).toBeInTheDocument();
    expect(screen.getByText('points committed')).toBeInTheDocument();
  });

  it('moves a card forward with the keyboard-friendly button', async () => {
    const { user } = setup();
    await openTeam(user);
    await user.click(screen.getByRole('button', { name: 'Move Quote builder with VAT forward' }));
    const inProgress = screen.getByRole('region', { name: 'In progress' });
    await waitFor(() => expect(within(inProgress).getByText('Quote builder with VAT')).toBeInTheDocument());
  });

  it('offers "Add anyway" when a sprint is over capacity', async () => {
    const { user } = setup();
    await openTeam(user);
    await user.click(screen.getAllByRole('button', { name: 'Add to Sprint 5' })[0]);
    expect(await screen.findByText(/Over capacity/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add anyway' }));
    const todo = screen.getByRole('region', { name: 'To do' });
    await waitFor(() => expect(within(todo).getAllByTestId(/^story-/)).toHaveLength(3));
  });

  it('adds a story to the backlog', async () => {
    const { user } = setup();
    await openTeam(user);
    await user.type(screen.getByLabelText('Story title'), 'Dark mode');
    await user.click(screen.getByRole('button', { name: 'Add story' }));
    expect(await screen.findByText('Dark mode')).toBeInTheDocument();
  });

  it('completes the sprint and reports the result', async () => {
    const { user } = setup();
    await openTeam(user);
    await user.click(screen.getByRole('button', { name: 'Complete sprint' }));
    expect(await screen.findByText(/8 of 27 points delivered/)).toBeInTheDocument();
  });
});
