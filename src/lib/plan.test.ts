import { describe, expect, it } from 'vitest';

import {
  autoRoute,
  drawRoute,
  duplicate,
  fits,
  freeSpot,
  layoutBody,
  planFromLayout,
  resizeSide,
  routeOf,
  transform,
  uniqueName,
} from './plan';
import type { Layout, Piece, PieceKind, Plan } from './plan';

function piece(key: string, x: number, y: number, w = 1, h = 5, kind: PieceKind = 'aisle'): Piece {
  return { key, id: key, name: key, kind, x, y, w, h, categoryIds: [] };
}

function plan(pieces: Piece[], extra: Partial<Plan> = {}): Plan {
  return { cols: 21, rows: 14, routeStyle: 'column', pieces, manualOrder: null, ...extra };
}

/** 2 x 8 wholesale: produce on the left, back and front blocks, cold room on the right. */
function wholesale(routeStyle: Plan['routeStyle']): Plan {
  const pieces = [
    piece('entrance', 0, 13, 3, 1, 'entrance'),
    piece('produce', 0, 1, 2, 11, 'island'),
    ...Array.from({ length: 8 }, (_, c) => piece(`b${c}`, 3 + 2 * c, 1)),
    ...Array.from({ length: 8 }, (_, c) => piece(`f${c}`, 3 + 2 * c, 7)),
    piece('cold', 19, 1, 2, 11, 'wall'),
    piece('checkout', 9, 13, 7, 1, 'checkout'),
  ];
  return plan(pieces, { routeStyle });
}

const keys = (p: Plan) => autoRoute(p).map((stop) => (stop.up ? '↑' : '↓') + stop.key);

describe('automatic zigzag', () => {
  it('walks up one column and down the next, from the entrance corner', () => {
    const p = plan(
      [
        piece('entrance', 0, 9, 3, 1, 'entrance'),
        piece('fruit', 0, 5, 2, 2, 'island'),
        piece('veg', 0, 1, 2, 3, 'island'),
        piece('a', 3, 1, 1, 7),
        piece('b', 5, 1, 1, 7),
      ],
      { rows: 10 },
    );
    // Fruit and vegetables share a column: both on the way up.
    expect(keys(p)).toEqual(['↑fruit', '↑veg', '↓a', '↑b']);
  });

  it('starts from the right when the entrance is on the right', () => {
    const p = plan([
      piece('entrance', 18, 13, 3, 1, 'entrance'),
      piece('a', 3, 1),
      piece('b', 5, 1),
    ]);
    expect(keys(p)).toEqual(['↑b', '↓a']);
  });

  it('crosses the middle aisle with each column in a 2 x 8 store', () => {
    expect(keys(wholesale('column')).slice(0, 6)).toEqual([
      '↑produce',
      '↓b0',
      '↓f0',
      '↑f1',
      '↑b1',
      '↓b2',
    ]);
    expect(keys(wholesale('column')).at(-1)).toBe('↓cold');
  });

  it('walks the far block, then the near block back, block by block', () => {
    const route = keys(wholesale('block'));
    expect(route.slice(0, 3)).toEqual(['↑produce', '↓b0', '↑b1']);
    expect(route.slice(8, 11)).toEqual(['↑b7', '↓cold', '↑f7']);
    expect(route.at(-1)).toBe('↓f0');
    expect(route).toHaveLength(18);
  });

  it('keeps a hand-picked order, adding new pieces at the end', () => {
    const p = plan([piece('a', 1, 1), piece('b', 3, 1), piece('c', 5, 1)], {
      manualOrder: ['c', 'a'],
    });
    expect(routeOf(p).map((stop) => stop.key)).toEqual(['c', 'a', 'b']);
  });

  it('draws the line from the entrance to the checkout through every stop', () => {
    const p = wholesale('column');
    const drawing = drawRoute(p, autoRoute(p), 10);
    expect(drawing.points[0]).toEqual([15, 135]); // entrance center
    expect(drawing.points.at(-1)).toEqual([125, 135]); // checkout center
    expect(drawing.badges.map((badge) => badge.n)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });
});

describe('editing the plan', () => {
  it('moves only inside the grid and never on top of another piece', () => {
    const p = plan([piece('a', 1, 1), piece('b', 3, 1)]);
    expect(transform(p, ['a'], (a) => ({ ...a, x: 2 }))).not.toBeNull();
    expect(transform(p, ['a'], (a) => ({ ...a, x: 3 }))).toBeNull(); // onto b
    expect(transform(p, ['a'], (a) => ({ ...a, x: -1 }))).toBeNull();
    // Moving both together, b does not block a.
    expect(transform(p, ['a', 'b'], (x) => ({ ...x, x: x.x + 2 }))).not.toBeNull();
  });

  it('duplicates next to the selection, growing the market, without categories', () => {
    const p = plan([{ ...piece('a', 1, 1), categoryIds: ['dairy'] }, piece('b', 3, 1)], {
      cols: 5,
    });
    const result = duplicate(p, ['a', 'b'])!;
    expect(result.copies).toHaveLength(2);
    const copies = result.pieces.filter((x) => result.copies.includes(x.key));
    expect(copies.map((x) => [x.name, x.x, x.categoryIds])).toEqual([
      ['a 2', 5, []],
      ['b 2', 7, []],
    ]);
    expect(result.cols).toBe(8);
  });

  it('duplicates a row of aisles below, leaving a cross aisle between the blocks', () => {
    const row = Array.from({ length: 8 }, (_, c) => piece(`a${c}`, 1 + 2 * c, 1, 1, 5));
    const result = duplicate(
      plan(row, { rows: 8 }),
      row.map((x) => x.key),
      'down',
    )!;
    const copies = result.pieces.filter((x) => result.copies.includes(x.key));
    expect(new Set(copies.map((x) => x.y))).toEqual(new Set([7]));
    expect(result.rows).toBe(12);
    // Column zigzag from the bottom-left: up the near copy, then up the far original.
    const names = new Map(result.pieces.map((x) => [x.key, x.name]));
    const route = autoRoute(plan(result.pieces, { rows: result.rows }));
    expect(route.slice(0, 2).map((stop) => names.get(stop.key))).toEqual(['a0 2', 'a0']);
  });

  it('keeps the entrance and checkout at the front when copying a block below', () => {
    const p = plan(
      [
        piece('a', 1, 1, 1, 5),
        piece('b', 3, 1, 1, 5),
        piece('in', 0, 7, 3, 1, 'entrance'),
        piece('out', 4, 7, 3, 1, 'checkout'),
      ],
      { cols: 8, rows: 8 },
    );
    const result = duplicate(p, ['a', 'b'], 'down')!;
    const y = (key: string) => result.pieces.find((x) => x.key === key)!.y;
    expect(result.copies.map(y)).toEqual([7, 7]); // right under the originals
    expect([y('in'), y('out')]).toEqual([13, 13]); // after a free lane row
    expect(result.rows).toBe(14);
  });

  it('copies to the left and up too, growing the grid on that side', () => {
    const p = plan([piece('a', 0, 0, 1, 5), piece('in', 2, 6, 2, 1, 'entrance')], {
      cols: 6,
      rows: 7,
    });
    const left = duplicate(p, ['a'], 'left')!;
    const at = (r: typeof left, key: string) => r.pieces.find((x) => x.key === key)!;
    expect(left.cols).toBe(8); // two more columns on the left
    expect([at(left, left.copies[0]!).x, at(left, 'a').x, at(left, 'in').x]).toEqual([0, 2, 4]);
    const up = duplicate(p, ['a'], 'up')!;
    expect(up.rows).toBe(13);
    expect([at(up, up.copies[0]!).y, at(up, 'a').y]).toEqual([0, 6]);
  });

  it('grows or shrinks any side, never cutting a piece', () => {
    const p = plan([piece('a', 0, 1, 1, 3)], { cols: 6, rows: 6 });
    const wider = resizeSide(p, 'left', 1)!;
    expect([wider.cols, wider.pieces[0]!.x]).toEqual([7, 1]);
    expect(resizeSide(p, 'left', -1)).toBeNull(); // the aisle touches the left edge
    const shorter = resizeSide(p, 'top', -1)!;
    expect([shorter.rows, shorter.pieces[0]!.y]).toEqual([5, 0]);
    expect(resizeSide(plan([], { cols: 4, rows: 4 }), 'right', -1)).toBeNull(); // minimum size
  });

  it('refuses to grow past the largest market', () => {
    const wide = plan([piece('a', 0, 0, 30, 1)], { cols: 30 });
    expect(duplicate(wide, ['a'])).toBeNull();
  });

  it('finds room for a new piece, adding rows when the grid is full', () => {
    const full = [piece('a', 0, 0, 4, 4)];
    expect(freeSpot(full, 2, 2, 4, 4)).toEqual({ x: 0, y: 4, rows: 6 });
    expect(fits({ x: 0, y: 4, w: 2, h: 2 }, full, 4, 6)).toBe(true);
  });

  it('keeps corridor names unique', () => {
    expect(uniqueName('Aisle', [piece('Aisle', 0, 0), piece('Aisle 2', 2, 0)])).toBe('Aisle 3');
    expect(uniqueName('Bakery', [piece('Aisle', 0, 0)])).toBe('Bakery');
  });
});

describe('saving and loading', () => {
  const layout: Layout = {
    market_id: 'm',
    plan: null,
    route_style: 'column',
    unmapped_categories: [],
    corridors: [
      {
        id: 'dairy',
        name: 'Dairy',
        position: 0,
        kind: 'aisle',
        x: null,
        y: null,
        w: null,
        h: null,
        categories: [],
      },
      {
        id: 'bakery',
        name: 'Bakery',
        position: 1,
        kind: 'aisle',
        x: null,
        y: null,
        w: null,
        h: null,
        categories: [],
      },
    ],
  };

  it('turns a plain list into a first plan, keeping its order', () => {
    const p = planFromLayout(layout);
    expect(p.pieces.map((x) => x.kind)).toEqual(['aisle', 'aisle', 'entrance', 'checkout']);
    expect(routeOf(p).map((stop) => stop.key)).toEqual(['dairy', 'bakery']);
  });

  it('sends corridors in walking order, entrance first and checkout last', () => {
    const body = layoutBody(planFromLayout(layout));
    expect(body.corridors.map((corridor) => corridor.name)).toEqual([
      'Entrance',
      'Dairy',
      'Bakery',
      'Checkout',
    ]);
    expect(body.corridors[1]).toMatchObject({ id: 'dairy', x: 1, y: 1, w: 1, h: 5 });
    expect(body.corridors[0]).not.toHaveProperty('id');
  });

  it('recognises an order chosen by hand when loading', () => {
    const saved: Layout = {
      ...layout,
      plan: { cols: 12, rows: 8 },
      corridors: [
        { ...layout.corridors[1]!, position: 0, x: 3, y: 1, w: 1, h: 5 },
        { ...layout.corridors[0]!, position: 1, x: 1, y: 1, w: 1, h: 5 },
      ],
    };
    expect(planFromLayout(saved).manualOrder).toEqual(['bakery', 'dairy']);
  });
});
