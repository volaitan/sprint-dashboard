import '@testing-library/jest-dom/vitest';

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom doesn't provide.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

beforeEach(() => localStorage.clear());
