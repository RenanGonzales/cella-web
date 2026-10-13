import { api, partnerStore } from '../api/client';
import type { ItemChanges, Me, ShoppingList } from '../api/types';
import { listItems } from './shopping';

const PAUSE_MS = 1400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sam, the demo's second person, shops his part of the route for real: the same API
 * calls his phone would make, with his own token. Three items go into his cart and one
 * is not found, a few seconds apart, so they can be watched arriving on Alex's phone.
 */
export async function runSam(
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const token = partnerStore.get();
  if (!token) return;
  const sam = await api<Me>('/me', { token });
  const list = await api<ShoppingList>('/shopping-list', { token });
  const route = listItems(list).filter(
    (item) => item.assigned_user_id === sam.id && item.status === 'pending',
  );
  const plan: [string, ItemChanges][] = route
    .slice(0, 4)
    .map((item, index) => [item.id, { status: index === 3 ? 'not_found' : 'checked' }]);

  onProgress(0, plan.length);
  for (const [index, [id, changes]] of plan.entries()) {
    await sleep(PAUSE_MS);
    if (isCancelled()) return;
    await api(`/shopping-list/items/${id}`, { method: 'PATCH', body: changes, token });
    onProgress(index + 1, plan.length);
  }
}
