/**
 * Market floor plan: pieces on a grid and the walking route through them.
 * Pure functions, so the editor stays thin and the rules are easy to test.
 */

export type PieceKind = 'aisle' | 'wall' | 'island' | 'entrance' | 'checkout';
export type RouteStyle = 'column' | 'block';

export interface Piece {
  /** Local key (the corridor id once saved). */
  key: string;
  /** Corridor id in the API; null for pieces added in this session. */
  id: string | null;
  name: string;
  kind: PieceKind;
  x: number;
  y: number;
  w: number;
  h: number;
  categoryIds: string[];
}

export interface Plan {
  cols: number;
  rows: number;
  routeStyle: RouteStyle;
  pieces: Piece[];
  /** Walking order chosen by hand (stop keys), or null for the automatic zigzag. */
  manualOrder: string[] | null;
}

export interface Stop {
  key: string;
  /** Walked from the bottom edge to the top one (otherwise top to bottom). */
  up: boolean;
}

export const LIMITS = { minSize: 4, maxCols: 40, maxRows: 30 } as const;

/** Entrance and checkout mark where the route starts and ends; they are not stops. */
export const isStop = (piece: { kind: PieceKind }): boolean =>
  piece.kind !== 'entrance' && piece.kind !== 'checkout';

type Box = Pick<Piece, 'x' | 'y' | 'w' | 'h'>;

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Inside the grid and not on top of any of `others`. */
export function fits(box: Box, others: Box[], cols: number, rows: number): boolean {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.w >= 1 &&
    box.h >= 1 &&
    box.x + box.w <= cols &&
    box.y + box.h <= rows &&
    !others.some((other) => overlaps(box, other))
  );
}

/** The smallest grid that still holds every piece. */
export function extent(pieces: Piece[]): { cols: number; rows: number } {
  return {
    cols: Math.max(LIMITS.minSize, ...pieces.map((piece) => piece.x + piece.w)),
    rows: Math.max(LIMITS.minSize, ...pieces.map((piece) => piece.y + piece.h)),
  };
}

/**
 * Move or resize some pieces together. Returns the new pieces, or null when the change
 * would leave the grid or hit another piece (the editor then simply does not move).
 */
export function transform(
  plan: Plan,
  keys: string[],
  change: (piece: Piece) => Box,
): Piece[] | null {
  const moving = new Set(keys);
  const others = plan.pieces.filter((piece) => !moving.has(piece.key));
  const moved = plan.pieces
    .filter((piece) => moving.has(piece.key))
    .map((p) => ({ ...p, ...change(p) }));
  for (const [index, piece] of moved.entries()) {
    if (!fits(piece, others, plan.cols, plan.rows)) return null;
    if (moved.slice(index + 1).some((other) => overlaps(piece, other))) return null;
  }
  const byKey = new Map(moved.map((piece) => [piece.key, piece]));
  return plan.pieces.map((piece) => byKey.get(piece.key) ?? piece);
}

/** First free spot for a w x h piece, scanning row by row; adds rows when the grid is full. */
export function freeSpot(
  pieces: Piece[],
  w: number,
  h: number,
  cols: number,
  rows: number,
): { x: number; y: number; rows: number } {
  for (let total = rows; total <= LIMITS.maxRows + h; total += 1) {
    for (let y = 0; y + h <= total; y += 1) {
      for (let x = 0; x + w <= cols; x += 1) {
        if (fits({ x, y, w, h }, pieces, cols, total)) return { x, y, rows: Math.max(rows, total) };
      }
    }
  }
  return { x: 0, y: rows, rows: rows + h };
}

/** "Aisle" -> "Aisle 2" when the name is taken (corridor names are unique per market). */
export function uniqueName(base: string, pieces: Piece[]): string {
  const taken = new Set(pieces.map((piece) => piece.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  const stem = base.replace(/\s+\d+$/, '');
  for (let n = 2; ; n += 1) {
    const name = `${stem} ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

let localKeys = 0;
export const newKey = (): string => `new-${(localKeys += 1)}`;

export type Direction = 'left' | 'right' | 'up' | 'down';

const STEP: Record<Direction, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

/** Moves every piece; used when the grid grows on the left or at the top. */
function shiftAll(pieces: Piece[], dx: number, dy: number): Piece[] {
  return pieces.map((piece) => ({ ...piece, x: piece.x + dx, y: piece.y + dy }));
}

/**
 * Copies of the selected pieces right next to them, on any side. When that side has no
 * room, the grid grows there (pieces stay where they are relative to each other).
 * Copying a row of aisles down builds a wholesale store with a cross aisle; an entrance
 * and checkout along the front edge stay at the front. Copies start without categories:
 * a category lives in one corridor per market.
 */
export function duplicate(
  plan: Plan,
  keys: string[],
  direction: Direction = 'right',
): { pieces: Piece[]; cols: number; rows: number; copies: string[] } | null {
  const picked = plan.pieces.filter((piece) => keys.includes(piece.key));
  if (picked.length === 0) return null;
  const [sx, sy] = STEP[direction];
  const horizontal = sx !== 0;
  const start = Math.min(...picked.map((piece) => (horizontal ? piece.x : piece.y)));
  const end = Math.max(
    ...picked.map((piece) => (horizontal ? piece.x + piece.w : piece.y + piece.h)),
  );
  let shift = end - start + 1;

  const front =
    direction === 'down'
      ? plan.pieces.filter(
          (piece) => !keys.includes(piece.key) && !isStop(piece) && piece.y + piece.h === plan.rows,
        )
      : [];
  const others = plan.pieces.filter((piece) => !keys.includes(piece.key) && !front.includes(piece));
  const moved = (piece: Piece) => ({ ...piece, x: piece.x + sx * shift, y: piece.y + sy * shift });
  while (picked.some((piece) => others.some((other) => overlaps(moved(piece), other)))) shift += 1;

  let pieces = [...plan.pieces];
  const copies: string[] = [];
  for (const piece of picked) {
    const copy: Piece = {
      ...moved(piece),
      key: newKey(),
      id: null,
      name: uniqueName(piece.name, pieces),
      categoryIds: [],
    };
    pieces.push(copy);
    copies.push(copy.key);
  }
  if (front.length > 0) {
    // One free lane row, then the front row.
    const bottom = Math.max(
      ...pieces.filter((piece) => !front.includes(piece)).map((piece) => piece.y + piece.h),
    );
    pieces = pieces.map((piece) => (front.includes(piece) ? { ...piece, y: bottom + 1 } : piece));
  }
  // Copies past the left or top edge: grow the grid on that side.
  const growX = Math.max(0, -Math.min(...pieces.map((piece) => piece.x)));
  const growY = Math.max(0, -Math.min(...pieces.map((piece) => piece.y)));
  pieces = shiftAll(pieces, growX, growY);
  const cols = Math.max(plan.cols + growX, ...pieces.map((piece) => piece.x + piece.w));
  const rows = Math.max(plan.rows + growY, ...pieces.map((piece) => piece.y + piece.h));
  if (cols > LIMITS.maxCols || rows > LIMITS.maxRows) return null;
  return { pieces, cols, rows, copies };
}

export type Side = 'left' | 'right' | 'top' | 'bottom';

/**
 * One more (+1) or one less (-1) row or column on a side of the market. Adding on the
 * left or top moves everything along; removing only works when that edge is empty.
 */
export function resizeSide(plan: Plan, side: Side, delta: 1 | -1): Plan | null {
  const horizontal = side === 'left' || side === 'right';
  const cols = plan.cols + (horizontal ? delta : 0);
  const rows = plan.rows + (horizontal ? 0 : delta);
  if (cols < LIMITS.minSize || rows < LIMITS.minSize) return null;
  if (cols > LIMITS.maxCols || rows > LIMITS.maxRows) return null;
  if (delta < 0) {
    const touches: Record<Side, (piece: Piece) => boolean> = {
      left: (piece) => piece.x === 0,
      right: (piece) => piece.x + piece.w === plan.cols,
      top: (piece) => piece.y === 0,
      bottom: (piece) => piece.y + piece.h === plan.rows,
    };
    if (plan.pieces.some(touches[side])) return null;
  }
  const dx = side === 'left' ? delta : 0;
  const dy = side === 'top' ? delta : 0;
  return { ...plan, cols, rows, pieces: shiftAll(plan.pieces, dx, dy) };
}

// --- Route -------------------------------------------------------------------

/**
 * The automatic zigzag. From the entrance's corner: up one column of pieces, down the
 * next, and so on. With two blocks of aisles (front and back, a cross aisle between):
 * - "column": each aisle end to end through the cross aisle, then back down the next;
 * - "block": the far block first, then the near block on the way back.
 */
export function autoRoute(plan: Plan): Stop[] {
  const stops = plan.pieces.filter(isStop);
  const entrance = plan.pieces.find((piece) => piece.kind === 'entrance');
  const leftToRight = entrance ? entrance.x + entrance.w / 2 <= plan.cols / 2 : true;
  let up = entrance ? entrance.y + entrance.h / 2 >= plan.rows / 2 : true;
  const route: Stop[] = [];
  const done = new Set<string>();
  const byX = (a: Piece, b: Piece) => (leftToRight ? a.x - b.x : b.x - a.x);

  const walkColumns = (pieces: Piece[]) => {
    const columns = new Map<number, Piece[]>();
    pieces
      .filter((piece) => !done.has(piece.key))
      .forEach((piece) => columns.set(piece.x, [...(columns.get(piece.x) ?? []), piece]));
    [...columns.keys()]
      .sort((a, b) => (leftToRight ? a - b : b - a))
      .forEach((x) => {
        const column = columns.get(x)!.sort((a, b) => (up ? b.y - a.y : a.y - b.y));
        column.forEach((piece) => {
          route.push({ key: piece.key, up });
          done.add(piece.key);
        });
        up = !up;
      });
  };

  const aisles = stops.filter((piece) => piece.kind === 'aisle');
  const blocks = [...new Set(aisles.map((piece) => `${piece.y}:${piece.h}`))]
    .map((key) => key.split(':').map(Number) as [number, number])
    .sort((a, b) => (up ? a[0] - b[0] : b[0] - a[0]));

  if (blocks.length < 2 || plan.routeStyle === 'column') {
    walkColumns(stops);
    return route;
  }

  // Block by block: what stands before the aisles, the far block, what stands after
  // them, then the near block walking back.
  const firstX = leftToRight
    ? Math.min(...aisles.map((piece) => piece.x))
    : Math.max(...aisles.map((piece) => piece.x + piece.w));
  const lastX = leftToRight
    ? Math.max(...aisles.map((piece) => piece.x + piece.w))
    : Math.min(...aisles.map((piece) => piece.x));
  const before = (piece: Piece) => (leftToRight ? piece.x + piece.w <= firstX : piece.x >= firstX);
  const after = (piece: Piece) => (leftToRight ? piece.x >= lastX : piece.x + piece.w <= lastX);

  walkColumns(stops.filter((piece) => piece.kind !== 'aisle' && before(piece)));
  blocks.forEach(([y, h], index) => {
    const row = aisles
      .filter((piece) => piece.y === y && piece.h === h)
      .sort((a, b) => (index % 2 === 0 ? byX(a, b) : byX(b, a)));
    row.forEach((piece) => {
      route.push({ key: piece.key, up });
      done.add(piece.key);
      up = !up;
    });
    if (index === 0) walkColumns(stops.filter((piece) => piece.kind !== 'aisle' && after(piece)));
  });
  walkColumns(stops); // anything left (islands among the aisles), at the end
  return route;
}

/** The route in use: the hand-picked order when there is one, else the zigzag. */
export function routeOf(plan: Plan): Stop[] {
  const auto = autoRoute(plan);
  if (!plan.manualOrder) return auto;
  const direction = new Map(auto.map((stop) => [stop.key, stop.up]));
  const picked = plan.manualOrder.filter((key) => direction.has(key));
  const rest = auto.filter((stop) => !picked.includes(stop.key));
  return [...picked.map((key) => ({ key, up: direction.get(key)! })), ...rest];
}

export interface RouteDrawing {
  points: [number, number][];
  badges: { key: string; n: number; x: number; y: number }[];
}

/**
 * The dotted line: along the free lane above or below each piece, then up or down it.
 * Coordinates in px for a grid of `cell` px.
 */
export function drawRoute(plan: Plan, stops: Stop[], cell: number): RouteDrawing {
  const byKey = new Map(plan.pieces.map((piece) => [piece.key, piece]));
  const entrance = plan.pieces.find((piece) => piece.kind === 'entrance');
  const checkout = plan.pieces.find((piece) => piece.kind === 'checkout');
  const centerX = (piece: Piece) => (piece.x + piece.w / 2) * cell;
  const points: [number, number][] = [];
  const badges: RouteDrawing['badges'] = [];

  let at: [number, number] | null = null;
  let lane = 0;
  if (entrance) {
    at = [centerX(entrance), (entrance.y + entrance.h / 2) * cell];
    lane =
      entrance.y >= plan.rows / 2
        ? (entrance.y - 0.5) * cell
        : (entrance.y + entrance.h + 0.5) * cell;
    points.push(at);
  }
  stops.forEach((stop, index) => {
    const piece = byKey.get(stop.key);
    if (!piece) return;
    const x = centerX(piece);
    const top = piece.y * cell;
    const bottom = (piece.y + piece.h) * cell;
    const [entryY, exitY] = stop.up ? [bottom, top] : [top, bottom];
    if (at) points.push([at[0], lane], [x, lane]);
    points.push([x, entryY], [x, exitY]);
    badges.push({
      key: stop.key,
      n: index + 1,
      x,
      y: stop.up ? entryY - cell * 0.4 : entryY + cell * 0.4,
    });
    at = [x, exitY];
    lane = stop.up ? top - cell / 2 : bottom + cell / 2;
  });
  if (checkout && at) {
    const x = centerX(checkout);
    points.push([at[0], lane], [x, lane], [x, (checkout.y + checkout.h / 2) * cell]);
  }
  return { points, badges };
}

// --- API conversion ------------------------------------------------------------

export interface LayoutCorridor {
  id: string;
  name: string;
  position: number;
  kind: PieceKind;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  categories: { id: string; name: string }[];
}

export interface Layout {
  market_id: string;
  plan: { cols: number; rows: number } | null;
  route_style: RouteStyle;
  corridors: LayoutCorridor[];
  unmapped_categories: { id: string; name: string }[];
}

/**
 * The editor's plan from the saved layout. A market without a plan gets a first draft:
 * its corridors side by side as aisles, an entrance and a checkout.
 */
export function planFromLayout(layout: Layout): Plan {
  if (layout.plan) {
    const pieces: Piece[] = layout.corridors.map((corridor) => ({
      key: corridor.id,
      id: corridor.id,
      name: corridor.name,
      kind: corridor.kind,
      x: corridor.x ?? 0,
      y: corridor.y ?? 0,
      w: corridor.w ?? 1,
      h: corridor.h ?? 1,
      categoryIds: corridor.categories.map((category) => category.id),
    }));
    const plan: Plan = {
      cols: layout.plan.cols,
      rows: layout.plan.rows,
      routeStyle: layout.route_style,
      pieces,
      manualOrder: null,
    };
    // Saved order different from the zigzag: it was chosen by hand.
    const saved = layout.corridors.filter(isStop).map((corridor) => corridor.id);
    const auto = autoRoute(plan).map((stop) => stop.key);
    return saved.join() === auto.join() ? plan : { ...plan, manualOrder: saved };
  }

  const corridors = layout.corridors.filter(isStop);
  const cols = Math.min(LIMITS.maxCols, Math.max(12, corridors.length * 2 + 2));
  const pieces: Piece[] = corridors.map((corridor, index) => ({
    key: corridor.id,
    id: corridor.id,
    name: corridor.name,
    kind: 'aisle',
    x: Math.min(1 + index * 2, cols - 1),
    y: 1,
    w: 1,
    h: 5,
    categoryIds: corridor.categories.map((category) => category.id),
  }));
  pieces.push(
    {
      key: newKey(),
      id: null,
      name: 'Entrance',
      kind: 'entrance',
      x: 0,
      y: 7,
      w: 3,
      h: 1,
      categoryIds: [],
    },
    {
      key: newKey(),
      id: null,
      name: 'Checkout',
      kind: 'checkout',
      x: cols - 5,
      y: 7,
      w: 5,
      h: 1,
      categoryIds: [],
    },
  );
  // Corridors that do not fit side by side wrap to a second row.
  const placed: Piece[] = [];
  for (const piece of pieces) {
    if (fits(piece, placed, cols, 8)) placed.push(piece);
    else {
      const spot = freeSpot(placed, piece.w, piece.h, cols, 8);
      placed.push({ ...piece, x: spot.x, y: spot.y });
    }
  }
  const draft: Plan = {
    cols,
    rows: Math.max(8, extent(placed).rows),
    routeStyle: 'column',
    pieces: placed,
    manualOrder: null,
  };
  // Keep the walking order the list already had, unless the zigzag gives the same one.
  const saved = corridors.map((corridor) => corridor.id);
  const auto = autoRoute(draft).map((stop) => stop.key);
  return saved.join() === auto.join() ? draft : { ...draft, manualOrder: saved };
}

/** Body of PUT /markets/{id}/layout: corridors in walking order. */
export function layoutBody(plan: Plan) {
  const byKey = new Map(plan.pieces.map((piece) => [piece.key, piece]));
  const ordered = [
    ...plan.pieces.filter((piece) => piece.kind === 'entrance'),
    ...routeOf(plan).map((stop) => byKey.get(stop.key)!),
    ...plan.pieces.filter((piece) => piece.kind === 'checkout'),
  ];
  return {
    plan: { cols: plan.cols, rows: plan.rows },
    route_style: plan.routeStyle,
    corridors: ordered.map((piece) => ({
      ...(piece.id ? { id: piece.id } : {}),
      name: piece.name,
      kind: piece.kind,
      x: piece.x,
      y: piece.y,
      w: piece.w,
      h: piece.h,
      category_ids: piece.categoryIds,
    })),
  };
}
