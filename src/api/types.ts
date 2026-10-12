/** Shapes returned by cella-api (see the API's /docs). */

export type ProductUnit = 'un' | 'kg' | 'g' | 'l' | 'ml';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface Member {
  id: string;
  name: string;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  household: { id: string; name: string; invite_code: string; members: Member[] };
}

export interface StorageArea {
  id: string;
  name: string;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category_id: string;
  storage_area_id: string;
  unit: ProductUnit;
  consume_step: number;
  ideal_quantity: number;
  min_quantity: number;
  current_quantity: number;
  below_ideal: boolean;
  needs_restock: boolean;
  last_price_cents: number | null;
  last_purchased_at: string | null;
  archived_at: string | null;
}

export interface ConsumeResponse {
  product: Product;
  consumption_event_id: string | null;
  consumed: number;
  added_to_list: boolean;
}

export interface UndoResponse {
  product: Product;
  restored: number;
}

export interface ShoppingListItem {
  id: string;
  product_id: string;
  name: string;
  brand: string | null;
  category: string;
  unit: ProductUnit;
  quantity_needed: number;
  quantity_bought: number | null;
  status: 'pending' | 'checked' | 'not_found';
  added_manually: boolean;
  assigned_user_id: string | null;
  last_price_cents: number | null;
}

export interface ShoppingList {
  id: string | null;
  status: 'open' | 'shopping' | 'archived' | null;
  market_id: string | null;
  sorted_by_market_id: string | null;
  item_count: number;
  groups: { corridor_id: string | null; name: string; items: ShoppingListItem[] }[];
}
