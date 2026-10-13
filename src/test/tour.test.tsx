import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { partnerStore, tokenStore } from '../api/client';
import { tourSteps } from '../components/tour/steps';
import i18n from '../i18n';
import { runSam } from '../lib/samBot';
import { readTour, startTour } from '../lib/tour';
import { makeProduct } from './factories';
import { apiPath, json, renderApp } from './render';

const fridge = { id: 'fridge', name: 'Fridge', position: 0 };

function fakeApi() {
  const milk = makeProduct({
    id: 'milk',
    name: 'Whole milk',
    unit: 'l',
    storage_area_id: 'fridge',
    current_quantity: 3,
  });
  const calls: { method: string; path: string; token: string | null; body?: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = apiPath(input);
      const method = init?.method ?? 'GET';
      const auth = new Headers(init?.headers).get('Authorization');
      calls.push({
        method,
        path,
        token: auth?.replace('Bearer ', '') ?? null,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (path === '/me')
        return json({
          id: 'alex',
          name: 'Alex',
          email: 'a@x',
          household: { id: 'h', name: 'Demo House', invite_code: 'X', members: [] },
          features: { receipt_ai: false, is_demo: true },
        });
      if (path === '/storage-areas') return json([fridge]);
      if (path === '/products') return json([milk]);
      if (path === '/shopping-list')
        return json({
          id: null,
          status: null,
          market_id: null,
          sorted_by_market_id: null,
          item_count: 0,
          groups: [],
        });
      if (path === '/products/milk/consume') {
        milk.current_quantity -= 1;
        return json({
          product: milk,
          consumption_event_id: 'e1',
          consumed: 1,
          added_to_list: true,
        });
      }
      return json({ detail: 'Not found' }, 404);
    }),
  );
  return { calls };
}

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('cella.token', 'alex-token');
  localStorage.setItem('cella.introSeen', '1');
  await i18n.changeLanguage('en');
  // jsdom has no layout: report every element as being on screen.
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
    new DOMRect(0, 0, 100, 40),
  ] as unknown as DOMRectList);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const caption = (title: string) => screen.findByRole('heading', { name: title }, { timeout: 3000 });

describe('Guided tour', () => {
  it('has the two-phone step only on large screens', () => {
    expect(tourSteps(true).map((step) => step.id)).toContain('two-phones');
    expect(tourSteps(false).map((step) => step.id)).not.toContain('two-phones');
    expect(tourSteps(false)).toHaveLength(14);
  });

  it('walks through the first steps: Next, a tap on the spot, an event from the app', async () => {
    fakeApi();
    const user = userEvent.setup();
    startTour();
    renderApp('/');

    expect(await caption('Your shopping list')).toBeInTheDocument();
    expect(screen.getByText('1 of 14')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await caption('Your home, by area')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByText('Tap the highlighted spot to continue.')).toBeInTheDocument();

    // The veil swallows clicks: only the spot itself works.
    await user.click(screen.getAllByTestId('tour-blocker')[0]!);
    expect(screen.getByRole('heading', { name: 'Your home, by area' })).toBeInTheDocument();

    await user.click(document.querySelector<HTMLElement>('[data-tour="area-Fridge"]')!);
    expect(await caption('Used something? One tap.')).toBeInTheDocument();
    expect(readTour()?.step).toBe('use');

    await user.click(await screen.findByRole('button', { name: 'Use 1 L of Whole milk' }));
    expect(await caption('Already on the list')).toBeInTheDocument();
  });

  it('stops with Skip or Esc', async () => {
    fakeApi();
    const user = userEvent.setup();
    startTour();
    renderApp('/');

    await caption('Your shopping list');
    await user.click(screen.getByRole('button', { name: 'Skip tour' }));
    await waitFor(() => expect(screen.queryByText('1 of 14')).not.toBeInTheDocument());
    expect(readTour()).toBeNull();

    act(() => startTour());
    await caption('Your shopping list');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(readTour()).toBeNull());
  });

  it('starts from the intro', async () => {
    fakeApi();
    localStorage.removeItem('cella.introSeen');
    const user = userEvent.setup();
    renderApp('/welcome');

    await user.click(await screen.findByRole('img', { name: 'Cella' }));
    await user.click(await screen.findByRole('button', { name: /Take the tour/ }));

    expect(await caption('Your shopping list')).toBeInTheDocument();
  });
});

describe('Demo with two people', () => {
  it("lets Sam shop his own part with his token, not Alex's", async () => {
    partnerStore.set('sam-token');
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
      id,
      assigned_user_id: 'sam',
      status: 'pending',
    }));
    const calls: { path: string; token: string | null; body?: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = apiPath(input);
        calls.push({
          path,
          token: new Headers(init?.headers).get('Authorization'),
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        if (path === '/me') return json({ id: 'sam' });
        if (path === '/shopping-list')
          return json({
            groups: [
              {
                corridor_id: 'c',
                name: 'C',
                items: [{ id: 'alex-item', assigned_user_id: 'alex', status: 'pending' }, ...items],
              },
            ],
          });
        return json({});
      }),
    );
    vi.useFakeTimers();
    const progress: number[] = [];
    const run = runSam(
      (done) => progress.push(done),
      () => false,
    );
    await vi.runAllTimersAsync();
    await run;
    vi.useRealTimers();

    const patches = calls.filter((call) => call.body !== undefined);
    expect(patches.map((call) => [call.path, call.body])).toEqual([
      ['/shopping-list/items/a', { status: 'checked' }],
      ['/shopping-list/items/b', { status: 'checked' }],
      ['/shopping-list/items/c', { status: 'checked' }],
      ['/shopping-list/items/d', { status: 'not_found' }],
    ]);
    expect(calls.every((call) => call.token === 'Bearer sam-token')).toBe(true);
    expect(progress).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps Sam's session next to Alex's and ends both on logout", () => {
    tokenStore.set('alex-token');
    partnerStore.set('sam-token');

    tokenStore.clear();

    expect(localStorage.getItem('cella.token')).toBeNull();
    expect(localStorage.getItem('cella.token.partner')).toBeNull();
  });

  it('shows both phones on large screens', async () => {
    fakeApi();
    partnerStore.set('sam-token');
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);
    renderApp('/demo');

    const alex = await screen.findByTitle("Alex's phone");
    const sam = screen.getByTitle("Sam's phone");
    expect(alex.getAttribute('src')).toBe(`${import.meta.env.BASE_URL}list`);
    expect(sam.getAttribute('src')).toBe(`${import.meta.env.BASE_URL}list?as=sam`);
    expect(within(screen.getByRole('main')).getByText('Alex · you')).toBeInTheDocument();
  });

  it('sends small screens to the list instead', async () => {
    fakeApi();
    partnerStore.set('sam-token');
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    renderApp('/demo');

    expect(await screen.findByRole('heading', { name: 'Shopping list' })).toBeInTheDocument();
  });
});
