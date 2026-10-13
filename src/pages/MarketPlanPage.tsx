import {
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  IconButton,
  Skeleton,
  Snackbar,
  TextField,
  useMediaQuery,
} from '@mui/material';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useLayout, useMarkets, useSaveLayout } from '../api/hooks';
import type { Market } from '../api/types';
import { Pill } from '../components/list/ItemDialog';
import { Sheet } from '../components/list/Sheet';
import { PlanCanvas } from '../components/plan/PlanCanvas';
import type { CanvasHandlers } from '../components/plan/PlanCanvas';
import { Icon } from '../components/ui';
import type { IconName } from '../components/ui';
import {
  LIMITS,
  autoRoute,
  drawRoute,
  duplicate,
  freeSpot,
  isStop,
  layoutBody,
  newKey,
  planFromLayout,
  resizeSide,
  routeOf,
  transform,
  uniqueName,
} from '../lib/plan';
import type { Direction, Layout, Piece, PieceKind, Plan, Side } from '../lib/plan';
import { glow, palette, theme } from '../theme';

/** Size of a new piece of each kind, in cells. */
const PALETTE: { id: string; kind: PieceKind; w: number; h: number }[] = [
  { id: 'aisle', kind: 'aisle', w: 1, h: 5 },
  { id: 'wall', kind: 'wall', w: 4, h: 1 },
  { id: 'square', kind: 'island', w: 2, h: 2 },
  { id: 'rectangle', kind: 'island', w: 3, h: 2 },
  { id: 'entrance', kind: 'entrance', w: 3, h: 1 },
  { id: 'checkout', kind: 'checkout', w: 5, h: 1 },
];

const MAX_CELL = 40;
/** Room around the grid for the + and − of each edge. */
const EDGE = 40;

const DIRECTIONS: [Direction, IconName][] = [
  ['left', 'arrowLeft'],
  ['up', 'arrowUp'],
  ['down', 'arrowDown'],
  ['right', 'arrowRight'],
];
const MIN_CELL = 18;

/** The floor plan of one market: an editor on large screens, the route on phones. */
export function MarketPlanPage() {
  const { marketId } = useParams();
  const { data: markets = [] } = useMarkets();
  const { data: layout, isLoading, isError } = useLayout(marketId);
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const market = markets.find((candidate) => candidate.id === marketId);

  if (isError) return <Box sx={{ p: 3, color: palette.textMuted }}>404</Box>;
  if (isLoading || !layout || !marketId) {
    return <Skeleton variant="rounded" height={480} sx={{ borderRadius: '30px', mt: 2 }} />;
  }
  return desktop ? (
    <PlanEditor key={layout.market_id} marketId={marketId} market={market} layout={layout} />
  ) : (
    <PlanOnPhone market={market} layout={layout} />
  );
}

/** Width available for the grid, so cells shrink to fit the screen. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function cellFor(width: number, cols: number): number {
  if (!width) return 32;
  return Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(width / cols)));
}

// --- Editor ------------------------------------------------------------------

function PlanEditor({
  marketId,
  market,
  layout,
}: {
  marketId: string;
  market: Market | undefined;
  layout: Layout;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const save = useSaveLayout(marketId);
  const [plan, setPlan] = useState<Plan>(() => planFromLayout(layout));
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(layoutBody(planFromLayout(layout))),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<'layout' | 'route'>('layout');
  const [picking, setPicking] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [boxRef, width] = useWidth<HTMLDivElement>();

  // Latest plan for event handlers that must answer right away (drag steps).
  const planRef = useRef(plan);
  const selectedRef = useRef(selected);
  useLayoutEffect(() => {
    planRef.current = plan;
    selectedRef.current = selected;
  }, [plan, selected]);

  const categories = useMemo(() => {
    const all = [
      ...layout.corridors.flatMap((corridor) => corridor.categories),
      ...layout.unmapped_categories,
    ];
    return new Map(all.map((category) => [category.id, category.name]));
  }, [layout]);

  const stops = routeOf(plan);
  const stopNumbers = new Map(stops.map((stop, index) => [stop.key, index + 1]));
  const cell = cellFor(width - EDGE * 2, plan.cols);
  const drawing = drawRoute(plan, stops, cell);
  const placedCategories = new Set(plan.pieces.flatMap((piece) => piece.categoryIds));
  const unplaced = [...categories].filter(([id]) => !placedCategories.has(id));
  const names = plan.pieces.map((piece) => piece.name.trim().toLowerCase());
  const nameClash = names.some((name, index) => !name || names.indexOf(name) !== index);
  const dirty = JSON.stringify(layoutBody(plan)) !== baseline;
  const aisleBlocks = new Set(
    plan.pieces.filter((piece) => piece.kind === 'aisle').map((piece) => `${piece.y}:${piece.h}`),
  );
  const single = selected.length === 1 ? plan.pieces.find((p) => p.key === selected[0]) : undefined;

  // Closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (pieces: Piece[], changes: Partial<Plan> = {}) =>
    setPlan((current) => ({ ...current, pieces, ...changes }));

  const handlers: CanvasHandlers = {
    onPick: (key, additive) => {
      if (mode === 'route') {
        const piece = planRef.current.pieces.find((p) => p.key === key);
        if (!piece || !isStop(piece)) return;
        const next = [...(picking ?? []).filter((k) => k !== key), key];
        setPicking(next);
        setPlan((current) => ({ ...current, manualOrder: next }));
        return;
      }
      setSelected((current) => {
        if (additive)
          return current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        return current.includes(key) ? current : [key];
      });
    },
    onMove: (dx, dy) => {
      const keys = selectedRef.current;
      if (keys.length === 0) return false;
      const moved = transform(planRef.current, keys, (p) => ({
        x: p.x + dx,
        y: p.y + dy,
        w: p.w,
        h: p.h,
      }));
      if (!moved) return false;
      planRef.current = { ...planRef.current, pieces: moved };
      update(moved);
      return true;
    },
    onResize: (dw, dh) => {
      const keys = selectedRef.current;
      if (keys.length !== 1) return false;
      const resized = transform(planRef.current, keys, (p) => ({
        x: p.x,
        y: p.y,
        w: p.w + dw,
        h: p.h + dh,
      }));
      if (!resized) return false;
      planRef.current = { ...planRef.current, pieces: resized };
      update(resized);
      return true;
    },
    onDelete: () => {
      update(plan.pieces.filter((piece) => !selected.includes(piece.key)));
      setSelected([]);
    },
    onDuplicate: () => copy('right'),
    onClear: () => setSelected([]),
  };

  function copy(direction: Direction) {
    const result = duplicate(plan, selected, direction);
    if (!result) return setMessage(t('plan.noRoom'));
    update(result.pieces, { cols: result.cols, rows: result.rows });
    setSelected(result.copies);
  }

  const add = (item: (typeof PALETTE)[number]) => {
    const spot = freeSpot(plan.pieces, item.w, item.h, plan.cols, plan.rows);
    if (spot.rows > LIMITS.maxRows) return setMessage(t('plan.noRoom'));
    const piece: Piece = {
      key: newKey(),
      id: null,
      name: uniqueName(t(`plan.kinds.${item.id}`), plan.pieces),
      kind: item.kind,
      x: spot.x,
      y: spot.y,
      w: item.w,
      h: item.h,
      categoryIds: [],
    };
    update([...plan.pieces, piece], { rows: spot.rows });
    setSelected([piece.key]);
  };

  const rotate = () => {
    if (!single) return;
    const turned = transform(plan, [single.key], (p) => ({ x: p.x, y: p.y, w: p.h, h: p.w }));
    if (turned) update(turned);
    else setMessage(t('plan.blocked'));
  };

  const editPiece = (key: string, changes: Partial<Piece>) =>
    update(plan.pieces.map((piece) => (piece.key === key ? { ...piece, ...changes } : piece)));

  const placeCategory = (categoryId: string) => {
    if (!single || !isStop(single)) return setMessage(t('plan.pickCorridor'));
    editPiece(single.key, { categoryIds: [...single.categoryIds, categoryId] });
  };

  const submit = () =>
    save.mutate(plan, {
      onSuccess: (saved) => {
        const fresh = planFromLayout(saved);
        setPlan(fresh);
        setBaseline(JSON.stringify(layoutBody(fresh)));
        setSelected([]);
        setMessage(t('plan.saved'));
      },
      onError: (error) =>
        setMessage(
          error instanceof ApiError && error.message ? error.message : t('errors.generic'),
        ),
    });

  const back = () => (dirty ? setLeaving(true) : navigate('/markets'));
  const hasEnd = (kind: PieceKind) => plan.pieces.some((piece) => piece.kind === kind);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box
        component="header"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <ButtonBase
            onClick={back}
            sx={{
              alignSelf: 'flex-start',
              gap: 0.75,
              fontSize: 14,
              color: palette.textMuted,
              borderRadius: 2,
            }}
          >
            <Icon name="back" size={16} />
            {t('nav.markets')}
          </ButtonBase>
          <Box
            component="h1"
            sx={{ m: 0, fontSize: 40, fontWeight: 500, letterSpacing: '-0.03em' }}
          >
            {market?.name ?? ' '}
          </Box>
          <Box component="p" sx={{ m: 0, color: palette.textMuted }}>
            {t('plan.summary', { stops: stops.length, count: unplaced.length })}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            role="tablist"
            aria-label={t('plan.mode')}
            sx={{ display: 'flex', gap: 0.5, p: 0.5, bgcolor: palette.surface, borderRadius: 999 }}
          >
            {(['layout', 'route'] as const).map((value) => (
              <Pill
                key={value}
                role="tab"
                selected={mode === value}
                onClick={() => {
                  setMode(value);
                  setPicking(null);
                  setSelected([]);
                }}
              >
                {t(`plan.modes.${value}`)}
              </Pill>
            ))}
          </Box>
          <Button
            variant="contained"
            onClick={submit}
            disabled={!dirty || nameClash || save.isPending}
            sx={{ height: 52, px: 3.5 }}
          >
            {t('list.save')}
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box
          component="section"
          aria-label={t('plan.title')}
          sx={{
            bgcolor: palette.surface,
            borderRadius: '30px',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Box sx={{ fontWeight: 500 }}>{t('plan.title')}</Box>
            <Box sx={{ fontSize: 13, color: palette.textMuted }}>
              {t('plan.sizeLabel', { cols: plan.cols, rows: plan.rows })}
            </Box>
          </Box>

          {aisleBlocks.size > 1 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Box sx={{ fontSize: 13, color: palette.textMuted }}>{t('plan.zigzag')}</Box>
              <Box
                role="radiogroup"
                aria-label={t('plan.zigzag')}
                sx={{ display: 'flex', gap: 0.5 }}
              >
                {(['column', 'block'] as const).map((style) => (
                  <Pill
                    key={style}
                    selected={plan.routeStyle === style}
                    onClick={() => setPlan({ ...plan, routeStyle: style })}
                  >
                    {t(`plan.styles.${style}`)}
                  </Pill>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
            {mode === 'layout' && selected.length > 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  pl: 2,
                  pr: 0.5,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: palette.navy,
                  color: '#FFFFFF',
                }}
              >
                <Box sx={{ fontSize: 14, mr: 1 }}>
                  {t('plan.selected', { count: selected.length })}
                </Box>
                <Box sx={{ fontSize: 13, opacity: 0.8, ml: 0.5 }}>{t('plan.duplicate')}</Box>
                {DIRECTIONS.map(([direction, icon]) => (
                  <IconButton
                    key={direction}
                    aria-label={t(`plan.duplicateTo.${direction}`)}
                    onClick={() => copy(direction)}
                    sx={{
                      color: '#FFFFFF',
                      bgcolor: 'rgba(255,255,255,0.16)',
                      width: 36,
                      height: 36,
                    }}
                  >
                    <Icon name={icon} size={16} />
                  </IconButton>
                ))}
                <DarkButton onClick={handlers.onDelete}>{t('plan.delete')}</DarkButton>
                <IconButton
                  aria-label={t('plan.clear')}
                  onClick={handlers.onClear}
                  sx={{ color: '#FFFFFF', transform: 'rotate(45deg)' }}
                >
                  <Icon name="plus" size={16} />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ fontSize: 13, color: palette.textMuted }}>
                {mode === 'route' ? t('plan.routeHint') : t('plan.layoutHint')}
              </Box>
            )}
          </Box>

          <Box ref={boxRef} sx={{ overflowX: 'auto' }}>
            <EdgeFrame
              plan={plan}
              active={mode === 'layout'}
              onResize={(side, delta) => {
                const next = resizeSide(plan, side, delta);
                if (next) setPlan(next);
              }}
            >
              <PlanCanvas
                plan={plan}
                cell={cell}
                selected={mode === 'layout' ? selected : []}
                drawing={drawing}
                stopNumbers={stopNumbers}
                dimOthers={mode === 'route'}
                handlers={handlers}
              />
            </EdgeFrame>
          </Box>

          {mode === 'layout' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Box sx={{ fontSize: 13, color: palette.textMuted, mr: 0.5 }}>{t('plan.add')}</Box>
              {PALETTE.map((item) => (
                <Button
                  key={item.id}
                  onClick={() => add(item)}
                  disabled={
                    (item.kind === 'entrance' || item.kind === 'checkout') && hasEnd(item.kind)
                  }
                  sx={{ bgcolor: palette.canvas, height: 40, px: 2, gap: 1 }}
                >
                  <Swatch kind={item.kind} w={item.w} h={item.h} />
                  {t(`plan.kinds.${item.id}`)}
                </Button>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mode === 'route' ? (
            <Panel title={t('plan.order')} text={t('plan.orderHint')}>
              <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                {stops.map((stop, index) => {
                  const piece = plan.pieces.find((p) => p.key === stop.key)!;
                  return (
                    <Box
                      component="li"
                      key={stop.key}
                      sx={{
                        minHeight: 40,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        borderTop: `1px solid ${palette.canvas}`,
                      }}
                    >
                      <Badge n={index + 1} />
                      <Box sx={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{piece.name}</Box>
                      <Box sx={{ fontSize: 12, color: palette.textFaint }}>
                        {t(stop.up ? 'plan.up' : 'plan.down')}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Button
                onClick={() => {
                  setPicking(null);
                  setPlan({ ...plan, manualOrder: null });
                }}
                disabled={plan.manualOrder === null}
                sx={{ bgcolor: palette.canvas }}
              >
                {t('plan.resetRoute')}
              </Button>
            </Panel>
          ) : single ? (
            <Inspector
              piece={single}
              stop={stopNumbers.get(single.key)}
              total={stops.length}
              up={autoRoute(plan).find((s) => s.key === single.key)?.up}
              categories={categories}
              available={unplaced}
              nameTaken={
                plan.pieces.some(
                  (p) =>
                    p.key !== single.key &&
                    p.name.trim().toLowerCase() === single.name.trim().toLowerCase(),
                ) || !single.name.trim()
              }
              onChange={(changes) => editPiece(single.key, changes)}
              onRotate={rotate}
              onDelete={handlers.onDelete}
            />
          ) : (
            <Panel title={t('plan.howTitle')} text={t('plan.howText')} />
          )}

          <Panel title={t('plan.unplaced')} text={t('plan.unplacedHint')}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {unplaced.length === 0 ? (
                <Box sx={{ fontSize: 13, color: palette.textFaint }}>{t('plan.allPlaced')}</Box>
              ) : (
                unplaced.map(([id, name]) => (
                  <ButtonBase
                    key={id}
                    onClick={() => placeCategory(id)}
                    sx={{
                      height: 36,
                      px: 1.75,
                      borderRadius: 999,
                      border: `1px dashed ${palette.steel}`,
                      color: palette.navyMid,
                      fontSize: 14,
                    }}
                  >
                    {name}
                  </ButtonBase>
                ))
              )}
            </Box>
          </Panel>
        </Box>
      </Box>

      {leaving && (
        <Sheet
          open
          onClose={() => setLeaving(false)}
          title={t('plan.leaveTitle')}
          actions={
            <>
              <Button onClick={() => setLeaving(false)} sx={{ color: 'text.secondary' }}>
                {t('plan.keepEditing')}
              </Button>
              <Button variant="contained" onClick={() => navigate('/markets')}>
                {t('plan.discard')}
              </Button>
            </>
          }
        >
          <Box component="p" sx={{ m: 0, color: palette.textMuted, fontSize: 14 }}>
            {t('plan.leaveText')}
          </Box>
        </Sheet>
      )}

      <Snackbar
        key={message}
        open={message !== null}
        autoHideDuration={4000}
        onClose={(_, reason) => reason !== 'clickaway' && setMessage(null)}
        message={message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

function Inspector({
  piece,
  stop,
  total,
  up,
  categories,
  available,
  nameTaken,
  onChange,
  onRotate,
  onDelete,
}: {
  piece: Piece;
  stop: number | undefined;
  total: number;
  up: boolean | undefined;
  categories: Map<string, string>;
  available: [string, string][];
  nameTaken: boolean;
  onChange: (changes: Partial<Piece>) => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const holdsCategories = isStop(piece);
  return (
    <Box
      component="section"
      aria-label={t('plan.selectedPiece')}
      sx={{
        bgcolor: palette.surface,
        backgroundImage: glow,
        borderRadius: '30px',
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.25,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <Box sx={{ color: palette.textMuted }}>
          {stop ? t('plan.stopOf', { n: stop, total }) : t('plan.notAStop')}
        </Box>
        {stop && up !== undefined && (
          <Box sx={{ color: palette.navyMid }}>{t(up ? 'plan.walkedUp' : 'plan.walkedDown')}</Box>
        )}
      </Box>
      <TextField
        label={t('plan.name')}
        value={piece.name}
        onChange={(event) => onChange({ name: event.target.value })}
        error={nameTaken}
        helperText={nameTaken ? t('plan.nameTaken') : ' '}
        slotProps={{ htmlInput: { maxLength: 50 } }}
      />
      {holdsCategories && (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ fontSize: 13, color: palette.textMuted }}>{t('plan.type')}</Box>
            <Box
              role="radiogroup"
              aria-label={t('plan.type')}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
            >
              {(['aisle', 'wall', 'island'] as const).map((kind) => (
                <Pill key={kind} selected={piece.kind === kind} onClick={() => onChange({ kind })}>
                  {t(`plan.kinds.${kind}`)}
                </Pill>
              ))}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ fontSize: 13, color: palette.textMuted }}>{t('plan.categories')}</Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {piece.categoryIds.map((id) => (
                <Box
                  key={id}
                  sx={{
                    height: 36,
                    pl: 1.75,
                    pr: 0.5,
                    borderRadius: 999,
                    bgcolor: palette.navy,
                    color: '#FFFFFF',
                    fontSize: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  {categories.get(id)}
                  <IconButton
                    size="small"
                    aria-label={t('plan.removeCategory', { name: categories.get(id) })}
                    onClick={() =>
                      onChange({ categoryIds: piece.categoryIds.filter((c) => c !== id) })
                    }
                    sx={{
                      color: '#FFFFFF',
                      bgcolor: 'rgba(255,255,255,0.16)',
                      width: 26,
                      height: 26,
                      transform: 'rotate(45deg)',
                    }}
                  >
                    <Icon name="plus" size={14} />
                  </IconButton>
                </Box>
              ))}
            </Box>
            <Autocomplete
              size="small"
              options={available}
              value={null}
              getOptionLabel={([, name]) => name}
              onChange={(_, option) =>
                option && onChange({ categoryIds: [...piece.categoryIds, option[0]] })
              }
              noOptionsText={t('plan.allPlaced')}
              renderInput={(params) => <TextField {...params} label={t('plan.addCategory')} />}
            />
          </Box>
        </>
      )}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pt: 1.5,
          borderTop: `1px solid ${palette.canvas}`,
        }}
      >
        <Box sx={{ fontSize: 13, color: palette.textMuted }}>
          {t('plan.cells', { w: piece.w, h: piece.h })}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Button onClick={onRotate} sx={{ bgcolor: palette.canvas }}>
            {t('plan.rotate')}
          </Button>
          <Button onClick={onDelete} sx={{ bgcolor: palette.canvas }}>
            {t('plan.delete')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

// --- Phone: the route, read only ----------------------------------------------

function PlanOnPhone({ market, layout }: { market: Market | undefined; layout: Layout }) {
  const { t } = useTranslation();
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const plan = useMemo(() => planFromLayout(layout), [layout]);
  const stops = routeOf(plan);
  const cell = width ? Math.max(8, Math.floor(width / plan.cols)) : 14;
  const drawing = drawRoute(plan, stops, cell);
  const categories = new Map(
    layout.corridors.map((corridor) => [
      corridor.id,
      corridor.categories.map((c) => c.name).join(' · '),
    ]),
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box component="header" sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 1 }}>
        <IconButton
          component={RouterLink}
          to="/markets"
          aria-label={t('area.back')}
          sx={{ bgcolor: palette.surface, color: palette.navy }}
        >
          <Icon name="back" size={20} />
        </IconButton>
        <Box component="h1" sx={{ m: 0, fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em' }}>
          {market?.name ?? ' '}
        </Box>
      </Box>
      <Box
        sx={{
          bgcolor: palette.surface,
          borderRadius: '26px',
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5, fontSize: 13 }}>
          <Box sx={{ fontWeight: 500 }}>{t('plan.yourRoute')}</Box>
          <Box sx={{ color: palette.textMuted }}>{t('plan.editLarger')}</Box>
        </Box>
        <Box ref={boxRef}>
          <PlanCanvas
            plan={plan}
            cell={cell}
            selected={[]}
            drawing={drawing}
            stopNumbers={new Map()}
            readOnly
          />
        </Box>
      </Box>
      <Box
        component="section"
        aria-label={t('plan.order')}
        sx={{ bgcolor: palette.surface, borderRadius: '26px', px: 2.25, py: 1 }}
      >
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {stops.map((stop, index) => {
            const piece = plan.pieces.find((p) => p.key === stop.key)!;
            return (
              <Box
                component="li"
                key={stop.key}
                sx={{
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  '& + &': { borderTop: `1px solid ${palette.canvas}` },
                }}
              >
                <Badge n={index + 1} />
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ fontSize: 15, fontWeight: 500 }}>{piece.name}</Box>
                  <Box sx={{ fontSize: 12, color: palette.textFaint }}>
                    {categories.get(stop.key) || ' '}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

// --- Small pieces -----------------------------------------------------------------

function Panel({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        bgcolor: palette.surface,
        borderRadius: '30px',
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Box sx={{ fontSize: 16, fontWeight: 500 }}>{title}</Box>
      <Box sx={{ fontSize: 13, color: palette.textMuted, lineHeight: 1.5 }}>{text}</Box>
      {children}
    </Box>
  );
}

function DarkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        height: 36,
        px: 1.75,
        borderRadius: 999,
        bgcolor: 'rgba(255,255,255,0.16)',
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {children}
    </ButtonBase>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <Box
      sx={{
        width: 24,
        height: 24,
        flexShrink: 0,
        borderRadius: '50%',
        bgcolor: palette.navy,
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {n}
    </Box>
  );
}

function Swatch({ kind, w, h }: { kind: PieceKind; w: number; h: number }) {
  const colors: Record<PieceKind, string> = {
    aisle: palette.steel,
    wall: palette.ice,
    island: palette.frost,
    entrance: palette.navy,
    checkout: palette.track,
  };
  const scale = 5;
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: Math.min(24, w * scale + 4),
        height: Math.min(22, h * scale + 4),
        borderRadius: kind === 'island' ? '7px' : '4px',
        bgcolor: colors[kind],
      }}
    />
  );
}

/** The grid with a + and − on each edge: grow or shrink the market on that side. */
function EdgeFrame({
  plan,
  active,
  onResize,
  children,
}: {
  plan: Plan;
  active: boolean;
  onResize: (side: Side, delta: 1 | -1) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const place: Record<Side, object> = {
    top: { top: 4, left: '50%', transform: 'translateX(-50%)', flexDirection: 'row' },
    bottom: { bottom: 4, left: '50%', transform: 'translateX(-50%)', flexDirection: 'row' },
    left: { left: 4, top: '50%', transform: 'translateY(-50%)', flexDirection: 'column' },
    right: { right: 4, top: '50%', transform: 'translateY(-50%)', flexDirection: 'column' },
  };
  const button = {
    width: 30,
    height: 30,
    bgcolor: palette.canvas,
    color: palette.navy,
    fontSize: 18,
    '&:hover': { bgcolor: palette.frost },
  };
  return (
    <Box sx={{ position: 'relative', p: `${EDGE}px`, width: 'fit-content', mx: 'auto' }}>
      {children}
      {active &&
        (['top', 'bottom', 'left', 'right'] as const).map((side) => (
          <Box
            key={side}
            role="group"
            aria-label={t(`plan.edges.${side}.name`)}
            sx={{ position: 'absolute', display: 'flex', gap: 0.5, ...place[side] }}
          >
            <IconButton
              aria-label={t(`plan.edges.${side}.remove`)}
              disabled={resizeSide(plan, side, -1) === null}
              onClick={() => onResize(side, -1)}
              sx={button}
            >
              −
            </IconButton>
            <IconButton
              aria-label={t(`plan.edges.${side}.add`)}
              disabled={resizeSide(plan, side, 1) === null}
              onClick={() => onResize(side, 1)}
              sx={button}
            >
              +
            </IconButton>
          </Box>
        ))}
    </Box>
  );
}
