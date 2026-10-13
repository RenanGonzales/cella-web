import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../i18n';
import { ALEX, MARKET, SAM, fakeShoppingApi } from './fakeShoppingApi';
import { renderApp } from './render';

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('cella.token', 'token');
  await i18n.changeLanguage('en');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const section = (name: string) => screen.getByRole('region', { name });

describe('Shopping list at home', () => {
  it("is sorted by the market's corridors, numbered in walking order", async () => {
    fakeShoppingApi();
    renderApp('/list');

    expect(await screen.findByRole('region', { name: '1 · Produce' })).toBeInTheDocument();
    expect(within(section('2 · Dairy')).getByText('Whole milk')).toBeInTheDocument();
    expect(within(section('Other')).getByText('Soap bar')).toBeInTheDocument();
    expect(screen.getByText(MARKET.name)).toBeInTheDocument();
    // 4 L x $5.49 + 1 x $3.99 = $25.95
    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByText('.95')).toBeInTheDocument();
  });

  it('changes how much to buy', async () => {
    const api = fakeShoppingApi();
    const user = userEvent.setup();
    renderApp('/list');

    await user.click(await screen.findByRole('button', { name: 'Edit Whole milk' }));
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.writes()).toContainEqual({
        method: 'PATCH',
        path: '/shopping-list/items/item-milk',
        body: { quantity_needed: 5 },
      }),
    );
    expect(await screen.findByText('5 L')).toBeInTheDocument();
  });

  it('removes an item', async () => {
    const api = fakeShoppingApi();
    const user = userEvent.setup();
    renderApp('/list');

    await user.click(await screen.findByRole('button', { name: 'Edit Soap bar' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Edit Soap bar' })).not.toBeInTheDocument(),
    );
    expect(api.writes()).toContainEqual({
      method: 'DELETE',
      path: '/shopping-list/items/item-soap',
      body: undefined,
    });
  });

  it('adds a product by hand, suggesting what fills it up to the ideal', async () => {
    const api = fakeShoppingApi();
    const user = userEvent.setup();
    renderApp('/list');

    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    await user.type(screen.getByRole('combobox', { name: 'Product' }), 'Pas');
    await user.click(await screen.findByRole('option', { name: 'Pasta' }));
    // Ideal 2 kg, has 1 kg, step 0.5 kg.
    expect(screen.getByText('1 kg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to list' }));

    await waitFor(() =>
      expect(api.writes()).toContainEqual({
        method: 'POST',
        path: '/shopping-list/items',
        body: { product_id: 'pasta', quantity_needed: 1 },
      }),
    );
    expect(await screen.findByRole('button', { name: 'Edit Pasta' })).toBeInTheDocument();
  });
});

describe('Shopping list in the store', () => {
  it('starts shopping at the chosen market', async () => {
    const api = fakeShoppingApi();
    const user = userEvent.setup();
    renderApp('/list');

    await user.click(await screen.findByRole('button', { name: 'Start shopping' }));

    expect(await screen.findByRole('button', { name: 'Finish shopping' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: MARKET.name })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 3 items in the cart' })).toBeInTheDocument();
    expect(api.writes()).toContainEqual({
      method: 'POST',
      path: '/shopping-list/start',
      body: { market_id: MARKET.id },
    });
  });

  it('checks items off and marks one as not found', async () => {
    const api = fakeShoppingApi({ status: 'shopping' });
    const user = userEvent.setup();
    renderApp('/list');

    const lettuce = await screen.findByRole('checkbox', { name: 'Lettuce' });
    await user.click(lettuce);
    expect(lettuce).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('img', { name: '1 of 3 items in the cart' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Options for Whole milk' }));
    await user.click(screen.getByRole('button', { name: 'Not found' }));

    expect(await screen.findByText('Not found · moves to the next list')).toBeInTheDocument();
    expect(api.writes().map((call) => call.body)).toEqual([
      { status: 'checked' },
      { status: 'not_found' },
    ]);
  });

  it('splits the route and shows only my part', async () => {
    const api = fakeShoppingApi({ status: 'shopping' });
    const user = userEvent.setup();
    renderApp('/list');

    await user.click(await screen.findByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Split the route' }));
    await user.click(screen.getByRole('button', { name: 'Split' }));

    const mine = await screen.findByRole('tab', { name: 'My route · 1' });
    expect(mine).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('checkbox', { name: 'Lettuce' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Whole milk' })).not.toBeInTheDocument();
    expect(api.writes()).toContainEqual({
      method: 'POST',
      path: '/shopping-list/split',
      body: { user_ids: [ALEX.id, SAM.id] },
    });

    await user.click(screen.getByRole('tab', { name: 'Everyone · 3' }));
    expect(screen.getByRole('checkbox', { name: 'Whole milk' })).toBeInTheDocument();
    expect(screen.getAllByLabelText("Sam's route")).toHaveLength(2);
  });

  it('finishes the purchase and reports what happened', async () => {
    const api = fakeShoppingApi({ status: 'shopping' });
    const user = userEvent.setup();
    renderApp('/list');

    await user.click(await screen.findByRole('checkbox', { name: 'Whole milk' }));
    await user.click(screen.getByRole('button', { name: 'Finish shopping' }));
    expect(screen.getByText('2 items move to your next list.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    expect(await screen.findByRole('heading', { name: 'Purchase saved' })).toBeInTheDocument();
    expect(screen.getByText('1 item added to your stock')).toBeInTheDocument();
    expect(screen.getByText('2 items moved to your next list')).toBeInTheDocument();
    // No prices yet for this purchase: estimate from the last ones (4 L x $5.49).
    expect(screen.getByText('$21')).toBeInTheDocument();
    expect(api.writes().at(-1)).toMatchObject({ path: '/shopping-list/checkout' });
    // Finishing here is not news for this phone.
    expect(screen.queryByText('The shopping was finished on another phone.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Back home' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('tells this phone when another one finished the shopping', async () => {
    const api = fakeShoppingApi({ status: 'shopping' });
    renderApp('/list');
    await screen.findByRole('button', { name: 'Finish shopping' });

    // Another phone checks out; the next refresh of the list brings the news.
    api.state.status = 'open';
    api.state.marketId = null;
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(
      await screen.findByText('The shopping was finished on another phone.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start shopping' })).toBeInTheDocument();
    focusManager.setFocused(undefined);
  });
});
