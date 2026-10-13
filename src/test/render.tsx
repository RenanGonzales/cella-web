import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { theme } from '../theme';

/** The whole app at `path`, with a fresh query cache and no retries. */
export function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

export function json(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Path of a fetch call without the API base: "http://x/shopping-list?a=1" -> "/shopping-list?a=1". */
export function apiPath(input: RequestInfo | URL): string {
  return String(input)
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/cella\/api/, '');
}
