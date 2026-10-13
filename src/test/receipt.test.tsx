import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PurchaseDetail } from '../api/types';
import { StockMeter } from '../components/StockMeter';
import i18n from '../i18n';
import { fakeShoppingApi } from './fakeShoppingApi';
import { json, renderApp } from './render';

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('cella.token', 'token');
  await i18n.changeLanguage('en');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function checkoutMilk(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('checkbox', { name: 'Whole milk' }));
  await user.click(screen.getByRole('button', { name: 'Finish shopping' }));
  await user.click(screen.getByRole('button', { name: 'Finish' }));
  await screen.findByRole('heading', { name: 'Purchase saved' });
}

describe('Receipt after checkout', () => {
  it('reviews the sample receipt and saves its prices (demo)', async () => {
    const api = fakeShoppingApi({ status: 'shopping' });
    const user = userEvent.setup();
    renderApp('/list');
    await checkoutMilk(user);

    await user.click(screen.getByRole('button', { name: 'Add the receipt' }));
    // The demo has no photo reader: the sample opens right away.
    expect(await screen.findByRole('heading', { name: 'Check the receipt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take a photo' })).toBeNull();
    expect(screen.getByText('Sample receipt')).toBeInTheDocument();
    const lines = within(screen.getByRole('list', { name: 'Receipt lines' }));
    expect(lines.getByText('WHOLE MILK')).toBeInTheDocument();
    expect(lines.getByText('↑ 9%')).toBeInTheDocument(); // $2.49 against $2.29

    const price = screen.getByRole('textbox', { name: 'Price of WHOLE MILK' });
    await user.clear(price);
    await user.type(price, '2,99');
    expect(lines.getByText('↑ 31%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save prices' }));
    expect(await screen.findByText('Paid, from the receipt. Prices updated.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add the receipt' })).toBeNull();
    expect(api.writes().at(-1)).toMatchObject({
      method: 'PUT',
      path: '/purchases/purchase-1/receipt',
      body: {
        source: 'sample',
        total_cents: 264,
        prices: [{ product_id: 'milk', unit_price_cents: 299 }],
      },
    });
  });

  it('does not save a product picked on two lines', async () => {
    fakeShoppingApi({ status: 'shopping' });
    const user = userEvent.setup();
    renderApp('/list');
    await checkoutMilk(user);
    await user.click(screen.getByRole('button', { name: 'Add the receipt' }));
    await screen.findByRole('heading', { name: 'Check the receipt' });

    await user.click(screen.getByRole('combobox', { name: 'Product for SHOPPING BAG' }));
    await user.click(await screen.findByRole('option', { name: 'Whole milk' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Whole milk is on more than one line');
    expect(screen.getByRole('button', { name: 'Save prices' })).toBeDisabled();
  });

  it('offers the photo only to accounts with the reader', async () => {
    fakeShoppingApi({ status: 'shopping', receiptAi: true, demo: false });
    const user = userEvent.setup();
    renderApp('/list');
    await checkoutMilk(user);
    await user.click(screen.getByRole('button', { name: 'Add the receipt' }));

    expect(await screen.findByRole('button', { name: 'Take a photo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use a sample receipt' }));
    expect(await screen.findByRole('heading', { name: 'Check the receipt' })).toBeInTheDocument();
  });
});

const PURCHASE: PurchaseDetail = {
  id: 'p-1',
  market_id: 'market-1',
  market_name: 'Neighborhood Market',
  started_at: '2026-10-06T14:00:00Z',
  completed_at: '2026-10-06T15:00:00Z',
  items_bought: 2,
  items_without_price: 0,
  total_cents: 1647,
  receipt_source: 'sample',
  receipt_total_cents: 1662,
  paid_cents: 1662,
  items: [
    {
      id: 'i-1',
      product_id: 'milk',
      name: 'Whole milk',
      brand: null,
      unit: 'l',
      status: 'checked',
      quantity_bought: 2,
      unit_price_cents: 549,
      line_total_cents: 1098,
    },
    {
      id: 'i-2',
      product_id: 'bread',
      name: 'Bread loaf',
      brand: null,
      unit: 'un',
      status: 'checked',
      quantity_bought: 1,
      unit_price_cents: 549,
      line_total_cents: 549,
    },
  ],
};

describe('History', () => {
  it('lists purchases by month and opens one with its prices', async () => {
    const api = fakeShoppingApi();
    api.purchases.push(PURCHASE);
    const user = userEvent.setup();
    renderApp('/history');

    expect(await screen.findByRole('heading', { name: 'History', level: 1 })).toBeInTheDocument();
    const october = await screen.findByRole('region', { name: 'October 2026' });
    const row = within(october).getByRole('button', { name: /Neighborhood Market/ });
    expect(row).toHaveTextContent('2 items · receipt');
    expect(row).toHaveTextContent('$16.62');

    await user.click(row);
    expect(await screen.findByText('Whole milk')).toBeInTheDocument();
    expect(screen.getByText('2 L × $5.49')).toBeInTheDocument();
    expect(screen.getByText('Prices from the sample receipt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review the receipt' })).toBeInTheDocument();
  });
});

describe('Invite', () => {
  it('shows the code, and that a demo copy cannot be joined', async () => {
    fakeShoppingApi();
    const user = userEvent.setup();
    renderApp('/');
    const invite = await screen.findAllByRole('button', { name: 'Invite someone' });
    await user.click(invite[0]!);
    expect(
      await screen.findByRole('heading', { name: 'Invite to Demo House' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Invite code')).toHaveTextContent('DEMO2026');
    expect(screen.getByText(/nobody can join it/)).toBeInTheDocument();
  });

  it('joins a household from the invite link', async () => {
    localStorage.clear();
    const calls: { path: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input)
          .replace(/^https?:\/\/[^/]+/, '')
          .replace(/^\/cella\/api/, '');
        calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (path === '/auth/register') {
          const body = JSON.parse(String(init?.body));
          return body.invite_code === 'GOOD1234'
            ? json({ access_token: 'new', token_type: 'bearer', expires_in: 1 }, 201)
            : json({ detail: 'Invite code not found' }, 404);
        }
        return json({ detail: 'Not found' }, 404);
      }),
    );
    const user = userEvent.setup();
    renderApp('/join/BAD');

    await user.type(await screen.findByRole('textbox', { name: 'Your name' }), 'Carol');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'carol@example.com');
    await user.type(screen.getByLabelText(/Password/), 'correct horse');
    expect(screen.getByRole('textbox', { name: 'Invite code' })).toHaveValue('BAD');
    await user.click(screen.getByRole('button', { name: 'Create account and join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This invite code does not exist');

    await user.clear(screen.getByRole('textbox', { name: 'Invite code' }));
    await user.type(screen.getByRole('textbox', { name: 'Invite code' }), 'GOOD1234');
    await user.click(screen.getByRole('button', { name: 'Create account and join' }));
    await waitFor(() => expect(localStorage.getItem('cella.token')).toBe('new'));
    expect(calls.filter((call) => call.path === '/auth/register').at(-1)?.body).toMatchObject({
      name: 'Carol',
      email: 'carol@example.com',
      invite_code: 'GOOD1234',
    });
  });
});

describe('Stock above the ideal', () => {
  it('fills the bar and says how much is over', () => {
    render(<StockMeter stock={{ current: 32, min: 6, ideal: 12 }} segments={12} over="+20" />);
    expect(screen.getByTestId('over-ideal')).toHaveTextContent('+20');
  });
});
