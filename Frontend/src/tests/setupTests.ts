// @testing-library/jest-dom adds custom DOM matchers for assertions.
// see: https://github.com/testing-library/jest-dom
import { expect } from 'vitest';
import matchers from '@testing-library/jest-dom/matchers';
import { vi } from 'vitest';

expect.extend(matchers);

// Provide a simple fetch mock that handles relative URLs so tests don't
// hit the network or throw "Invalid URL" errors.
vi.stubGlobal(
  'fetch',
  (async (input: RequestInfo | URL) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      input = 'http://localhost' + input;
    } else if (input instanceof Request && input.url.startsWith('/')) {
      input = new Request('http://localhost' + input.url, input);
    }
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
