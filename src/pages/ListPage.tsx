import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Snackbar,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { ApiError, partnerStore, persona } from '../api/client';
import {
  useAddItem,
  useCancelShopping,
  useCheckout,
  useMarkets,
  useMe,
  useProducts,
  useRemoveItem,
  useShoppingList,
  useSplitRoute,
  useStartShopping,
  useUpdateItem,
} from '../api/hooks';
import type {
  CheckoutResponse,
  ItemChanges,
  Market,
  Member,
  PurchaseDetail,
  ShoppingList,
  ShoppingListItem,
} from '../api/types';
import { useFocusMode } from '../components/FocusMode';
import { AddItemDialog } from '../components/list/AddItemDialog';
import { BottomAction } from '../components/list/BottomAction';
import { CheckoutDialog } from '../components/list/CheckoutDialog';
import { ReceiptDialog } from '../components/receipt/ReceiptDialog';
import { Pill, PlanItemDialog, StoreItemDialog } from '../components/list/ItemDialog';
import { PlanRow, StoreRow } from '../components/list/ItemRow';
import { Sheet } from '../components/list/Sheet';
import { SplitDialog } from '../components/list/SplitDialog';
import { BigNumber, Card, Icon, Money, SegmentBar } from '../components/ui';
import { splitMoney } from '../lib/format';
import {
  MARKET_KEY,
  NO_MARKET,
  cartStats,
  isSplit,
  listItems,
  listSections,
  stepOf,
} from '../lib/shopping';
import type { CartStats, ListSection } from '../lib/shopping';
import { listStats } from '../lib/stats';
import { useStoredString } from '../lib/storage';
import { emitTourEvent } from '../lib/tour';
import { palette } from '../theme';

/** Segment bars switch to a plain bar above this many items. */
const MAX_SEGMENTS = 30;

/**
 * The shopping list. At home it is planned (quantities, items by hand, market to sort by);
 * once shopping starts the same screen becomes the in-store checklist.
 */
export function ListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: markets = [] } = useMarkets();
  const [storedMarket, setStoredMarket] = useStoredString(MARKET_KEY);
  // "none": the household chose to shop without a market (list by category).
  const sortMarket =
    storedMarket === NO_MARKET
      ? null
      : (markets.find((market) => market.id === storedMarket) ?? markets[0] ?? null);
  const { data: list, isLoading } = useShoppingList(sortMarket?.id ?? null);

  const shopping = list?.status === 'shopping';
  useFocusMode(shopping);

  // Someone else may have started shopping at another market: follow their sorting.
  useEffect(() => {
    if (!shopping) return;
    if (list.market_id && list.market_id !== sortMarket?.id) setStoredMarket(list.market_id);
    if (!list.market_id && sortMarket?.id) setStoredMarket(NO_MARKET);
  }, [shopping, list?.market_id, sortMarket?.id, setStoredMarket]);

  const [message, setMessage] = useState<string | null>(null);
  const notify = (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) setMessage(t('list.changedElsewhere'));
    else if (error instanceof ApiError && error.status === 0) setMessage(t('errors.offline'));
    else setMessage(t('errors.generic'));
  };

  // Tell this phone when another one finished (or left) the shopping.
  const leavingHere = useRef(false);
  const previousStatus = useRef(list?.status);
  useEffect(() => {
    if (list === undefined) return;
    if (previousStatus.current === 'shopping' && !shopping && !leavingHere.current) {
      setMessage(t('list.finishedElsewhere'));
    }
    if (shopping) leavingHere.current = false;
    previousStatus.current = list.status;
  }, [list, shopping, t]);

  const checkout = useCheckout();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null);
  const [cartAtCheckout, setCartAtCheckout] = useState<CartStats | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<PurchaseDetail | null>(null);
  const items = listItems(list);

  const finish = () => {
    leavingHere.current = true;
    setCartAtCheckout(cartStats(items));
    checkout.mutate(undefined, {
      onSuccess: (result) => {
        setCheckoutResult(result);
        emitTourEvent('checkout');
      },
      onError: (error) => {
        leavingHere.current = false;
        setCartAtCheckout(null);
        setCheckoutOpen(false);
        notify(error);
      },
    });
  };

  const members: Member[] = me
    ? [
        ...me.household.members.filter((member) => member.id === me.id),
        ...me.household.members.filter((member) => member.id !== me.id),
      ]
    : [];

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {isLoading || !list ? (
        <>
          <Skeleton variant="rounded" height={60} sx={{ borderRadius: '30px', mt: 2 }} />
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: '30px' }} />
        </>
      ) : shopping ? (
        <StoreView
          list={list}
          market={markets.find((market) => market.id === list.market_id) ?? null}
          meId={me?.id ?? null}
          members={members}
          onError={notify}
          onLeave={() => {
            leavingHere.current = true;
          }}
          onFinish={() => setCheckoutOpen(true)}
        />
      ) : (
        <PlanView
          list={list}
          markets={markets}
          sortMarket={sortMarket}
          onSortBy={setStoredMarket}
          onError={notify}
        />
      )}

      {checkoutOpen && receiptOpen && checkoutResult && (
        <ReceiptDialog
          purchaseId={checkoutResult.purchase_id}
          canRead={me?.features.receipt_ai ?? false}
          onClose={() => setReceiptOpen(false)}
          onSaved={(detail) => {
            setReceipt(detail);
            setReceiptOpen(false);
            emitTourEvent('receipt');
          }}
        />
      )}
      {checkoutOpen && !receiptOpen && (
        <CheckoutDialog
          stats={cartAtCheckout ?? cartStats(items)}
          result={checkoutResult}
          busy={checkout.isPending}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={finish}
          onDone={() => {
            setCheckoutOpen(false);
            setCheckoutResult(null);
            setCartAtCheckout(null);
            setReceipt(null);
            navigate('/');
          }}
          onReceipt={() => setReceiptOpen(true)}
          receipt={receipt}
        />
      )}

      <Snackbar
        key={message}
        open={message !== null}
        autoHideDuration={5000}
        onClose={(_, reason) => reason !== 'clickaway' && setMessage(null)}
        message={message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        // Above the screen's main button (and the bottom navigation on phones).
        sx={{ bottom: { xs: 168, md: 100 } }}
      />
    </Box>
  );
}

// --- At home ------------------------------------------------------------------

function PlanView({
  list,
  markets,
  sortMarket,
  onSortBy,
  onError,
}: {
  list: ShoppingList;
  markets: Market[];
  sortMarket: Market | null;
  onSortBy: (marketId: string) => void;
  onError: (error: unknown) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: products = [] } = useProducts();
  const addItem = useAddItem();
  const updateItem = useUpdateItem();
  const removeItem = useRemoveItem();
  const start = useStartShopping();
  const [choosing, setChoosing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const items = listItems(list);
  const stats = listStats(list, products);
  const sections = listSections(list, { otherLabel: t('list.other') });
  const editing = items.find((item) => item.id === editingId) ?? null;
  const onList = new Set(items.map((item) => item.product_id));

  return (
    <>
      <PageHeader title={t('list.title')} />

      <Card highlight padding={3}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <BigNumber value={stats.items} suffix={t('home.items', { count: stats.items })} />
          <Box>
            <Box sx={{ fontSize: 13, color: palette.textMuted }}>{t('home.estimated')}</Box>
            <Box sx={{ fontSize: 26, letterSpacing: '-0.02em' }}>
              <Money parts={splitMoney(stats.estimatedCents, i18n.language)} />
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            mt: 2.5,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            fontSize: 14,
            color: palette.textMuted,
          }}
        >
          {t('list.sortedBy')}
          <Box
            role="radiogroup"
            aria-label={t('list.sortedBy')}
            sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}
          >
            {markets.map((market) => (
              <Pill
                key={market.id}
                selected={market.id === sortMarket?.id}
                onClick={() => onSortBy(market.id)}
              >
                {market.name}
              </Pill>
            ))}
            <Pill selected={!sortMarket} onClick={() => onSortBy(NO_MARKET)}>
              {t('list.noMarketOption')}
            </Pill>
          </Box>
          <Box
            component={RouterLink}
            to="/markets"
            sx={{ fontSize: 13, color: palette.navyMid, textUnderlineOffset: 3, ml: 'auto' }}
          >
            {t('list.manageMarkets')}
          </Box>
        </Box>
      </Card>

      {sections.length === 0 ? (
        <Card>
          <Box sx={{ color: palette.textMuted }}>{t('home.listEmpty')}</Box>
        </Card>
      ) : (
        <Sections sections={sections}>
          {(item) => <PlanRow key={item.id} item={item} onOpen={() => setEditingId(item.id)} />}
        </Sections>
      )}

      <Button
        onClick={() => setAdding(true)}
        startIcon={<Icon name="plus" size={18} />}
        sx={{ alignSelf: 'flex-start', bgcolor: palette.surface, px: 2.5, height: 44 }}
      >
        {t('list.add')}
      </Button>

      {items.length > 0 && (
        <BottomAction
          tourId="start-shopping"
          label={t('list.startShopping')}
          disabled={start.isPending}
          onClick={() => setChoosing(true)}
        />
      )}

      {choosing && (
        <StartSheet
          markets={markets}
          initial={sortMarket?.id ?? NO_MARKET}
          busy={start.isPending}
          onClose={() => setChoosing(false)}
          onStart={(choice) => {
            onSortBy(choice);
            start.mutate(choice === NO_MARKET ? null : choice, {
              onError: (error) => {
                setChoosing(false);
                onError(error);
              },
              onSuccess: () => {
                setChoosing(false);
                emitTourEvent('started');
              },
            });
          }}
        />
      )}

      {editing && (
        <PlanItemDialog
          key={editing.id}
          item={editing}
          step={stepOf(editing.product_id, products)}
          onClose={() => setEditingId(null)}
          onSave={(changes) => {
            setEditingId(null);
            updateItem.mutate({ id: editing.id, changes }, { onError });
          }}
          onRemove={() => {
            setEditingId(null);
            removeItem.mutate(editing.id, { onError });
          }}
        />
      )}

      {adding && (
        <AddItemDialog
          open
          products={products.filter(
            (product) => product.archived_at === null && !onList.has(product.id),
          )}
          onClose={() => setAdding(false)}
          onAdd={(product, quantity) => {
            setAdding(false);
            addItem.mutate({ product_id: product.id, quantity_needed: quantity }, { onError });
          }}
        />
      )}
    </>
  );
}

// --- In the store -------------------------------------------------------------

type Tab = 'mine' | 'all';

function StoreView({
  list,
  market,
  meId,
  members,
  onError,
  onLeave,
  onFinish,
}: {
  list: ShoppingList;
  market: Market | null;
  meId: string | null;
  members: Member[];
  onError: (error: unknown) => void;
  onLeave: () => void;
  onFinish: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: products = [] } = useProducts();
  const updateItem = useUpdateItem();
  const addItem = useAddItem();
  const split = useSplitRoute();
  const cancel = useCancelShopping();

  const [chosenTab, setChosenTab] = useState<Tab | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = listItems(list);
  const routeSplit = isSplit(list);
  const mine = items.filter((item) => item.assigned_user_id === meId);
  const tab: Tab = routeSplit ? (chosenTab ?? (mine.length > 0 ? 'mine' : 'all')) : 'all';
  const visible = tab === 'mine' ? mine : items;
  const stats = cartStats(visible);
  const sections = listSections(list, {
    otherLabel: t('list.other'),
    onlyUserId: tab === 'mine' ? meId : null,
  });
  const editing = items.find((item) => item.id === editingId) ?? null;
  const onList = new Set(items.map((item) => item.product_id));
  const memberById = new Map(members.map((member) => [member.id, member]));

  const change = (item: ShoppingListItem, changes: ItemChanges) =>
    updateItem.mutate({ id: item.id, changes }, { onError });
  const toggle = (item: ShoppingListItem) =>
    change(item, { status: item.status === 'checked' ? 'pending' : 'checked' });

  // Demo on a phone: no room for two phones, so offer to switch between Alex and Sam.
  // (Not inside the two-phone page, where both are already on screen.)
  const switchTarget =
    window.self !== window.top
      ? null
      : persona === 'partner'
        ? { url: `${import.meta.env.BASE_URL}list`, label: 'list.switchToMain' }
        : partnerStore.get()
          ? { url: `${import.meta.env.BASE_URL}list?as=sam`, label: 'list.switchToPartner' }
          : null;

  const money = splitMoney(stats.cartCents, i18n.language);
  const left = stats.pending;

  return (
    <>
      <Box
        component="header"
        sx={{
          pt: { xs: 2.5, md: 0 },
          display: 'grid',
          gridTemplateColumns: '44px minmax(0, 1fr) 44px',
          alignItems: 'center',
        }}
      >
        <IconButton
          component={RouterLink}
          to="/"
          aria-label={t('area.back')}
          sx={{ color: palette.navy, width: 44, height: 44 }}
        >
          <Icon name="back" size={22} />
        </IconButton>
        <Box
          component="h1"
          sx={{ m: 0, textAlign: 'center', fontSize: 16, fontWeight: 500, color: palette.navy }}
        >
          {market?.name ?? t('list.noMarketTitle')}
        </Box>
        <IconButton
          aria-label={t('list.menu')}
          aria-haspopup="menu"
          data-tour="store-menu"
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          sx={{ color: palette.navy, width: 44, height: 44 }}
        >
          <Icon name="more" size={26} />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={menuAnchor !== null}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { borderRadius: '20px', minWidth: 220 } } }}
        >
          {members.length > 1 && (
            <MenuItem
              data-tour="menu-split"
              onClick={() => {
                setMenuAnchor(null);
                setSplitting(true);
              }}
            >
              {t('list.split')}
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setAdding(true);
            }}
          >
            {t('list.add')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setLeaving(true);
            }}
          >
            {t('list.cancelShopping')}
          </MenuItem>
          {switchTarget && (
            <MenuItem onClick={() => window.location.assign(switchTarget.url)}>
              {t(switchTarget.label)}
            </MenuItem>
          )}
        </Menu>
      </Box>

      <Box component="section" sx={{ px: 1.25 }}>
        <Box sx={{ fontSize: 15, color: palette.textMuted }}>{t('list.inCart')}</Box>
        <Box sx={{ mt: 0.75 }}>
          <BigNumber value={stats.checked} suffix={`/ ${stats.total}`} size={72} />
        </Box>
        <Box sx={{ mt: 1, fontSize: 14, color: palette.textSoft }}>
          {stats.unpriced > 0 && '~'}
          <Money parts={money} />
          <Box component="span" sx={{ color: palette.textMuted }}>
            {' · '}
            {tab === 'mine' ? t('list.yourRoute') : t('list.wholeList')}
            {' · '}
            {t('list.left', { count: left })}
          </Box>
        </Box>
        <Box sx={{ mt: 2 }}>
          {stats.total <= MAX_SEGMENTS ? (
            <SegmentBar
              strong={stats.checked}
              soft={0}
              total={stats.total}
              height={8}
              label={t('list.progress', { checked: stats.checked, total: stats.total })}
            />
          ) : (
            <Box
              role="img"
              aria-label={t('list.progress', { checked: stats.checked, total: stats.total })}
              sx={{ height: 8, borderRadius: 4, bgcolor: palette.track, overflow: 'hidden' }}
            >
              <Box
                sx={{
                  height: 8,
                  width: `${(stats.checked / Math.max(stats.total, 1)) * 100}%`,
                  bgcolor: palette.navy,
                }}
              />
            </Box>
          )}
        </Box>
      </Box>

      {routeSplit && (
        <Box
          role="tablist"
          aria-label={t('list.whose')}
          sx={{ display: 'flex', gap: 0.75, px: 1.25 }}
        >
          <Pill role="tab" selected={tab === 'mine'} onClick={() => setChosenTab('mine')}>
            {t('list.myRoute', { count: mine.length })}
          </Pill>
          <Pill
            role="tab"
            tourId="tab-everyone"
            selected={tab === 'all'}
            onClick={() => setChosenTab('all')}
          >
            {t('list.everyone', { count: items.length })}
          </Pill>
        </Box>
      )}

      {sections.length === 0 ? (
        <Card>
          <Box sx={{ color: palette.textMuted }}>{t('list.routeEmpty')}</Box>
        </Card>
      ) : (
        <Sections sections={sections}>
          {(item) => (
            <StoreRow
              key={item.id}
              item={item}
              tourId={item.id === sections[0]?.items[0]?.id ? 'store-item' : undefined}
              owner={
                tab === 'all' && item.assigned_user_id
                  ? memberById.get(item.assigned_user_id)
                  : undefined
              }
              onToggle={() => toggle(item)}
              onOpen={() => setEditingId(item.id)}
            />
          )}
        </Sections>
      )}

      <BottomAction tourId="finish-shopping" label={t('list.finish')} onClick={onFinish} />

      {editing && (
        <StoreItemDialog
          key={editing.id}
          item={editing}
          step={stepOf(editing.product_id, products)}
          members={members}
          onClose={() => setEditingId(null)}
          onSave={(changes) => {
            setEditingId(null);
            change(editing, changes);
          }}
        />
      )}

      {splitting && (
        <SplitDialog
          members={members}
          busy={split.isPending}
          onClose={() => setSplitting(false)}
          onSplit={(userIds) =>
            split.mutate(userIds, {
              onSuccess: () => {
                setSplitting(false);
                setChosenTab('mine');
                emitTourEvent('split');
              },
              onError: (error) => {
                setSplitting(false);
                onError(error);
              },
            })
          }
        />
      )}

      {leaving && (
        <Sheet
          open
          onClose={() => setLeaving(false)}
          title={t('list.leaveTitle')}
          actions={
            <>
              <Button onClick={() => setLeaving(false)} sx={{ color: 'text.secondary' }}>
                {t('list.keepShopping')}
              </Button>
              <Button
                variant="contained"
                disabled={cancel.isPending}
                onClick={() => {
                  onLeave();
                  cancel.mutate(undefined, {
                    onSettled: () => setLeaving(false),
                    onError,
                  });
                }}
              >
                {t('list.leaveConfirm')}
              </Button>
            </>
          }
        >
          <Box component="p" sx={{ m: 0, color: palette.textMuted, fontSize: 14 }}>
            {t('list.leaveText')}
          </Box>
        </Sheet>
      )}

      {adding && (
        <AddItemDialog
          open
          products={products.filter(
            (product) => product.archived_at === null && !onList.has(product.id),
          )}
          onClose={() => setAdding(false)}
          onAdd={(product, quantity) => {
            setAdding(false);
            addItem.mutate({ product_id: product.id, quantity_needed: quantity }, { onError });
          }}
        />
      )}
    </>
  );
}

// --- Shared -------------------------------------------------------------------

function PageHeader({ title }: { title: string }) {
  return (
    <Box component="header" sx={{ px: { xs: 1, md: 0 }, pt: { xs: 1, md: 0 } }}>
      <Box
        component="h1"
        sx={{ m: 0, fontSize: { xs: 34, md: 40 }, fontWeight: 500, letterSpacing: '-0.03em' }}
      >
        {title}
      </Box>
    </Box>
  );
}

/** One white card per corridor (or category), items separated by thin lines. */
function Sections({
  sections,
  children,
}: {
  sections: ListSection[];
  children: (item: ShoppingListItem) => ReactNode;
}) {
  return (
    <Box data-tour="list-sections" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {sections.map((section, index) => (
        <Box
          component="section"
          key={section.key}
          data-tour={index === 0 ? 'list-first-section' : undefined}
          aria-label={section.title}
          sx={{ bgcolor: palette.surface, borderRadius: '26px', px: 2.25, pt: 1.75, pb: 0.75 }}
        >
          <Box
            component="h2"
            sx={{ m: 0, mb: 0.25, fontSize: 13, fontWeight: 400, color: palette.textMuted }}
          >
            {section.title}
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              '& > * + *': { borderTop: `1px solid ${palette.canvas}` },
            }}
          >
            {section.items.map((item) => children(item))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** "Where are you shopping?": the household's markets, or somewhere without a plan. */
function StartSheet({
  markets,
  initial,
  busy,
  onClose,
  onStart,
}: {
  markets: Market[];
  initial: string;
  busy: boolean;
  onClose: () => void;
  onStart: (marketId: string) => void;
}) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState(initial);
  const options = [
    ...markets.map((market) => ({
      id: market.id,
      name: market.name,
      hint: market.has_plan
        ? t('list.withPlan')
        : t('list.corridorCount', { count: market.corridor_count }),
    })),
    { id: NO_MARKET, name: t('list.elsewhere'), hint: t('list.elsewhereHint') },
  ];
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('list.whereTitle')}
      actions={
        <>
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
            {t('list.close')}
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => onStart(choice)}
            data-tour="start-confirm"
          >
            {t('list.startConfirm')}
          </Button>
        </>
      }
    >
      <Box
        role="radiogroup"
        aria-label={t('list.whereTitle')}
        sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {options.map((option) => {
          const selected = option.id === choice;
          return (
            <ButtonBase
              key={option.id}
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(option.id)}
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                gap: 1.5,
                p: 1.75,
                borderRadius: '18px',
                bgcolor: selected ? palette.frost : palette.canvas,
                outline: selected ? `2px solid ${palette.navy}` : 'none',
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  borderRadius: '50%',
                  border: `2px solid ${palette.navy}`,
                  bgcolor: selected ? palette.navy : 'transparent',
                  boxShadow: selected ? 'inset 0 0 0 3px #FFFFFF' : 'none',
                }}
              />
              <Box>
                <Box sx={{ fontSize: 15, fontWeight: 500 }}>{option.name}</Box>
                <Box sx={{ fontSize: 12, color: palette.textMuted }}>{option.hint}</Box>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Sheet>
  );
}
