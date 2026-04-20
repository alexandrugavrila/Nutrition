import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  window.sessionStorage.clear();
});

// Provide a simple fetch mock so tests don't hit the network.
vi.stubGlobal(
  'fetch',
  (async () => {
    return new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch,
);

// Silence React act() warnings from third-party components to keep test
// output focused on actionable errors.
const error = console.error;
vi.spyOn(console, 'error').mockImplementation((msg, ...args) => {
  if (typeof msg === 'string' && msg.includes('not wrapped in act')) {
    return;
  }
  error(msg, ...args);
});
